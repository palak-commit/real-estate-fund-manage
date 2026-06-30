import { pool } from "@/lib/db";
import { recomputeBalances } from "@/lib/ledger";
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
 * stores the id and then calls `recompute()`.
 */
export async function postIncome(d: IncomeData): Promise<number | null> {
  if (!d.account_id || !(Number(d.amount) > 0)) return null;
  const [r]: any = await pool.query(
    `INSERT INTO transactions (type, txn_date, project_id, dest_account_id, amount, paid_to, note)
     VALUES ('income', ?, ?, ?, ?, ?, ?)`,
    [dateOf(d), d.project_id || null, d.account_id, d.amount, d.paid_to || null, d.note || "RA bill payment"]
  );
  await logActivity({
    action: "created",
    entity: "transaction",
    entityId: r.insertId,
    title: "RA receipt payment",
    amount: d.amount,
    meta: { source: "ra_payment" },
  });
  return r.insertId as number;
}

export async function deleteIncome(txnId: number): Promise<void> {
  await pool.query("DELETE FROM transactions WHERE id = ?", [txnId]);
  await logActivity({
    action: "deleted",
    entity: "transaction",
    entityId: txnId,
    title: "RA receipt payment removed",
    meta: { source: "ra_payment" },
  });
}

export const recompute = () => recomputeBalances(true);
