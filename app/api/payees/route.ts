import { query } from "@/lib/db";
import { ok } from "@/lib/api";

// Distinct "Paid To" names pulled from past transactions, most-used first.
// Used by the PaidToPicker so the admin can reuse a payee instead of retyping it.
// No dedicated table — paid_to is free text on transactions, so a new payee
// persists automatically once its transaction is saved.
export async function GET() {
  const rows = await query<{ name: string }>(
    `SELECT paid_to AS name, COUNT(*) AS uses
       FROM transactions
      WHERE paid_to IS NOT NULL AND TRIM(paid_to) <> ''
      GROUP BY paid_to
      ORDER BY uses DESC, MAX(txn_date) DESC
      LIMIT 200`
  );
  return ok(rows.map((r) => r.name), "Payees fetched successfully");
}
