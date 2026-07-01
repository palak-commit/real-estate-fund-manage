import { query } from "@/lib/db";
import { ok } from "@/lib/api";

// Distinct "Paid To" names, most-used first, used by the PaidToPicker so the admin
// can reuse a payee instead of retyping it. There's no dedicated payees table —
// paid_to is free text — so we pull the names from every place they're stored:
// transactions, RA receipts, and vendor bills. That way a payee first entered on an
// RA receipt or a (still-unpaid) vendor bill is suggested in the other forms too.
export async function GET() {
  const rows = await query<{ name: string }>(
    `SELECT name, SUM(uses) AS uses, MAX(last_date) AS last_date
       FROM (
         SELECT paid_to AS name, COUNT(*) AS uses, MAX(txn_date) AS last_date
           FROM transactions
          WHERE paid_to IS NOT NULL AND TRIM(paid_to) <> ''
          GROUP BY paid_to
         UNION ALL
         SELECT paid_to AS name, COUNT(*) AS uses, MAX(txn_date) AS last_date
           FROM ra_receipts
          WHERE paid_to IS NOT NULL AND TRIM(paid_to) <> ''
          GROUP BY paid_to
         UNION ALL
         SELECT paid_to AS name, COUNT(*) AS uses, MAX(txn_date) AS last_date
           FROM vendor_bills
          WHERE paid_to IS NOT NULL AND TRIM(paid_to) <> ''
          GROUP BY paid_to
       ) u
      GROUP BY name
      ORDER BY uses DESC, last_date DESC
      LIMIT 200`
  );
  return ok(rows.map((r) => r.name), "Payees fetched successfully");
}
