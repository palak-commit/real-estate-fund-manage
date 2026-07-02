import type { PoolConnection } from "mysql2/promise";
import { pool, query } from "@/lib/db";
import { recomputeBalances, toPaisa, toRupees } from "@/lib/ledger";
import { RECEIVED_SQL, SPENT_SQL, SITE_OUT_SQL, SITE_XFER_OUT_SQL } from "@/lib/queries";
import { inr } from "@/lib/format";
import { logActivity } from "@/lib/activity";

// Server-side glue between an RA receipt's partial payments and the real `income`
// transactions that credit the chosen account. Keeping the money in normal transactions
// means account balances, the reconciler (recomputeBalances) and the dashboard all stay
// correct — the RA register never maintains balances itself.

export type IncomeData = {
  txn_date: string | null;
  project_id?: number | null;
  account_id?: number | null;
  paid_to?: string | null;
  amount: number;
  note?: string | null;
};

const dateOf = (d: IncomeData) => d.txn_date || new Date().toISOString().slice(0, 10);

/**
 * Post a payment as an `income` transaction. With an `account_id` it credits that account;
 * with no account but a `project_id` it credits the **site's own funds** (income with no
 * dest account, which RECEIVED_SQL counts as money into the site) — the "Received In: Site
 * Fund" case. Returns the new txn id, or null when there's nothing to credit (no target, or
 * non-positive amount). The caller stores the id and then calls `recompute()`. Pass an open
 * transaction connection as `conn` to make the income insert + audit row atomic.
 */
export async function postIncome(d: IncomeData, conn?: PoolConnection): Promise<number | null> {
  if (!(Number(d.amount) > 0) || (!d.account_id && !d.project_id)) return null;
  const db = conn ?? pool;
  const [r]: any = await db.query(
    `INSERT INTO transactions (type, txn_date, project_id, dest_account_id, amount, paid_to, note)
     VALUES ('income', ?, ?, ?, ?, ?, ?)`,
    [dateOf(d), d.project_id || null, d.account_id || null, d.amount, d.paid_to || null, d.note || "RA bill payment"]
  );
  // Look up names for a readable "from → into" detail line in the activity feed.
  let projectName: string | null = null;
  if (d.project_id) {
    const [pr]: any = await db.query("SELECT name FROM projects WHERE id = ?", [d.project_id]);
    projectName = pr[0]?.name ?? null;
  }
  let targetName = "site funds";
  if (d.account_id) {
    const [acc]: any = await db.query("SELECT name FROM accounts WHERE id = ?", [d.account_id]);
    targetName = acc[0]?.name ?? "account";
  }
  // e.g. "River View → Axis Bank · jayesh kaka" (into an account) or "River View → site funds"
  const detail = `${projectName ? `${projectName} ` : ""}→ ${targetName}${d.paid_to ? ` · ${d.paid_to}` : ""}`;
  await logActivity(
    {
      action: "created",
      entity: "transaction",
      entityId: r.insertId,
      projectId: d.project_id ?? null,
      title: "RA receipt payment",
      amount: d.amount,
      meta: { source: "ra_payment", detail },
    },
    conn
  );
  return r.insertId as number;
}

/**
 * Guard for deleting RA income: removing these `income` transactions subtracts the money
 * they credited from their account. If that money has since been spent (the account balance
 * is already below what would be reversed), reversing it would push the account negative —
 * i.e. dependent expenses rely on it. Returns a plain-language block message, or null when
 * the reversal is safe. Mirrors the funds guard on the plain-transaction delete so RA
 * receipt/payment deletes can't silently corrupt balances.
 */
export async function incomeReversalBlock(txnIds: number[]): Promise<string | null> {
  const ids = txnIds.filter((t): t is number => !!t);
  if (!ids.length) return null;
  const rows = await query<{ dest_account_id: number | null; amount: number }>(
    `SELECT dest_account_id, amount FROM transactions
      WHERE id IN (${ids.map(() => "?").join(",")}) AND type = 'income' AND dest_account_id IS NOT NULL`,
    ids
  );
  if (!rows.length) return null;
  // Sum the credited amount per account (integer paisa) that this delete would reverse.
  const perAccount = new Map<number, number>();
  for (const r of rows) {
    const acc = r.dest_account_id as number;
    perAccount.set(acc, (perAccount.get(acc) ?? 0) + toPaisa(Number(r.amount)));
  }
  const accIds = [...perAccount.keys()];
  const accounts = await query<{ id: number; name: string; current_balance: number }>(
    `SELECT id, name, current_balance FROM accounts WHERE id IN (${accIds.map(() => "?").join(",")})`,
    accIds
  );
  for (const a of accounts) {
    const creditP = perAccount.get(a.id) ?? 0;
    if (toPaisa(Number(a.current_balance)) < creditP) {
      return `Cannot delete — ${a.name} only has ${inr(Number(a.current_balance))} left, but this credited it ${inr(toRupees(creditP))}. That money has already been used; delete the payments/expenses that spent it first.`;
    }
  }
  return siteFundReversalBlock(ids);
}

// Site-fund income (income with no dest account, tagged to a site — the "Received In: Site
// Fund" case) raises the site's derived funds; reversing it lowers them. Refuse if the site's
// remaining funds (received − site-fund spend) are already below what we'd remove — that
// money has been spent from the site, and reversing would push the balance negative. Mirrors
// the account guard above for the site-fund flavour.
async function siteFundReversalBlock(ids: number[]): Promise<string | null> {
  const rows = await query<{ project_id: number; amount: number }>(
    `SELECT project_id, amount FROM transactions
      WHERE id IN (${ids.map(() => "?").join(",")}) AND type = 'income'
        AND dest_account_id IS NULL AND project_id IS NOT NULL`,
    ids
  );
  if (!rows.length) return null;
  const perSite = new Map<number, number>();
  for (const r of rows) {
    perSite.set(r.project_id, (perSite.get(r.project_id) ?? 0) + toPaisa(Number(r.amount)));
  }
  const siteIds = [...perSite.keys()];
  const balances = await query<{ id: number; name: string; balance: number }>(
    `SELECT p.id, p.name, (${RECEIVED_SQL} - ${SPENT_SQL} - ${SITE_OUT_SQL} - ${SITE_XFER_OUT_SQL}) AS balance
       FROM projects p LEFT JOIN transactions t ON t.project_id = p.id
      WHERE p.id IN (${siteIds.map(() => "?").join(",")})
      GROUP BY p.id, p.name`,
    siteIds
  );
  for (const b of balances) {
    const removeP = perSite.get(b.id) ?? 0;
    if (toPaisa(Number(b.balance)) < removeP) {
      return `Cannot delete — ${b.name} only has ${inr(Number(b.balance))} of site funds left, but this added ${inr(toRupees(removeP))}. That money has already been spent from the site; delete the site-funded expenses first.`;
    }
  }
  return null;
}

export async function deleteIncome(txnId: number): Promise<void> {
  const [pr]: any = await pool.query("SELECT project_id FROM transactions WHERE id = ?", [txnId]);
  const projectId = pr[0]?.project_id ?? null;
  await pool.query("DELETE FROM transactions WHERE id = ?", [txnId]);
  await logActivity({
    action: "deleted",
    entity: "transaction",
    entityId: txnId,
    projectId,
    title: "RA receipt payment removed",
    meta: { source: "ra_payment" },
  });
}

export const recompute = () => recomputeBalances(true);
