import type { PoolConnection } from "mysql2/promise";
import { pool, query } from "@/lib/db";
import { recomputeBalances, toPaisa, toRupees } from "@/lib/ledger";
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
 * Post a payment as an `income` transaction crediting its account. Returns the new txn id,
 * or null when there's nothing to credit (no account, or non-positive amount). The caller
 * stores the id and then calls `recompute()`. Pass an open transaction connection as `conn`
 * to make the income insert + its audit row atomic with the caller's own writes.
 */
export async function postIncome(d: IncomeData, conn?: PoolConnection): Promise<number | null> {
  if (!d.account_id || !(Number(d.amount) > 0)) return null;
  const db = conn ?? pool;
  const [r]: any = await db.query(
    `INSERT INTO transactions (type, txn_date, project_id, dest_account_id, amount, paid_to, note)
     VALUES ('income', ?, ?, ?, ?, ?, ?)`,
    [dateOf(d), d.project_id || null, d.account_id, d.amount, d.paid_to || null, d.note || "RA bill payment"]
  );
  // Look up names for a readable "from → into" detail line in the activity feed.
  const [acc]: any = await db.query("SELECT name FROM accounts WHERE id = ?", [d.account_id]);
  const accountName = acc[0]?.name ?? "account";
  let projectName: string | null = null;
  if (d.project_id) {
    const [pr]: any = await db.query("SELECT name FROM projects WHERE id = ?", [d.project_id]);
    projectName = pr[0]?.name ?? null;
  }
  // e.g. "River View → Axis Bank · jayesh kaka" (from the site, into the account, paid by)
  const detail = `${projectName ? `${projectName} ` : ""}→ ${accountName}${d.paid_to ? ` · ${d.paid_to}` : ""}`;
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
