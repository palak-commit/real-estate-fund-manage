import type { PoolConnection } from "mysql2/promise";
import { pool } from "@/lib/db";
import { recomputeBalances } from "@/lib/ledger";
import { logActivity } from "@/lib/activity";

// Server-side glue between a vendor bill's payments and the real `expense` transactions that
// move the money out. Mirrors lib/raTxn.ts (which posts `income`), but on the paying side:
// each payment posts an `expense` so account balances, the reconciler (recomputeBalances)
// and the dashboard stay correct — the vendor-bill register never maintains balances itself.

export type ExpenseData = {
  txn_date: string | null;
  project_id: number; // vendor bills always belong to a site
  account_id?: number | null; // null = paid from the site's own funds
  category_id?: number | null;
  paid_to?: string | null;
  amount: number;
  note?: string | null;
};

const dateOf = (d: ExpenseData) => d.txn_date || new Date().toISOString().slice(0, 10);

/**
 * Post a payment as an `expense` transaction. With an `account_id` it debits that account
 * (a "Direct" site expense — balance drops, site balance untouched); without one it lowers
 * the site's allocated funds (`source_account_id` NULL). Returns the new txn id, or null when
 * the amount is non-positive. Pass an open transaction connection as `conn` to make the
 * expense insert + its audit row atomic with the caller's own writes.
 */
export async function postExpense(d: ExpenseData, conn?: PoolConnection): Promise<number | null> {
  if (!(Number(d.amount) > 0)) return null;
  const db = conn ?? pool;
  const [r]: any = await db.query(
    `INSERT INTO transactions (type, txn_date, project_id, source_account_id, amount, category_id, paid_to, note)
     VALUES ('expense', ?, ?, ?, ?, ?, ?, ?)`,
    [dateOf(d), d.project_id, d.account_id || null, d.amount, d.category_id || null, d.paid_to || null, d.note || "Vendor bill payment"]
  );
  // Look up names for a readable "paid from → vendor · site" detail line in the activity feed.
  let accountName = "Site funds";
  if (d.account_id) {
    const [acc]: any = await db.query("SELECT name FROM accounts WHERE id = ?", [d.account_id]);
    accountName = acc[0]?.name ?? "account";
  }
  const [pr]: any = await db.query("SELECT name FROM projects WHERE id = ?", [d.project_id]);
  const projectName: string | null = pr[0]?.name ?? null;
  // e.g. "Paid from HDFC Bank → Shree Cement · Royal Enclave"
  const detail = `Paid from ${accountName}${d.paid_to ? ` → ${d.paid_to}` : ""}${projectName ? ` · ${projectName}` : ""}`;
  await logActivity(
    {
      action: "created",
      entity: "transaction",
      entityId: r.insertId,
      title: "Vendor bill payment",
      amount: d.amount,
      meta: { source: "vendor_payment", detail },
    },
    conn
  );
  return r.insertId as number;
}

export async function deleteExpense(txnId: number): Promise<void> {
  await pool.query("DELETE FROM transactions WHERE id = ?", [txnId]);
  await logActivity({
    action: "deleted",
    entity: "transaction",
    entityId: txnId,
    title: "Vendor bill payment removed",
    meta: { source: "vendor_payment" },
  });
}

export const recompute = () => recomputeBalances(true);
