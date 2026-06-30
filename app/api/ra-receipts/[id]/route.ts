import { NextRequest } from "next/server";
import { z } from "zod";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { raReceiptSchema, parseId, zErr } from "@/lib/validation";
import { deleteIncome, recompute } from "@/lib/raTxn";

// Lightweight status-only update (used when payments auto-complete/partial a bill).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid RA receipt id", 400);
  const parsed = z.object({ status: z.enum(["pending", "partial", "complete"]) }).safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) return fail(zErr(parsed.error));
  const [res]: any = await pool.query("UPDATE ra_receipts SET status = ? WHERE id = ?", [parsed.data.status, id]);
  if (!res.affectedRows) return fail("RA receipt not found", 404);
  return ok(null, "Status updated");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid RA receipt id", 400);
  const parsed = raReceiptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const d = parsed.data;

  const existing = await query<{ txn_id: number | null }>("SELECT txn_id FROM ra_receipts WHERE id = ?", [id]);
  if (!existing.length) return fail("RA receipt not found", 404);

  await pool.query(
    `UPDATE ra_receipts
        SET txn_date = ?, project_id = ?, account_id = ?, paid_to = ?, amount = ?,
            withheld_amt = ?, royalty = ?, agency_charge = ?, sub_let_bill = ?, net_receivable = ?, note = ?, status = ?, txn_id = NULL
      WHERE id = ?`,
    [d.txn_date || null, d.project_id || null, d.account_id || null, d.paid_to || null, d.amount,
     d.withheld_amt, d.royalty, d.agency_charge, d.sub_let_bill, d.net_receivable || 0, d.note || null, d.status, id]
  );

  // Drop any legacy receipt-level income (old full-Net-Receivable behaviour) — money now
  // lives only on the partial payments.
  if (existing[0].txn_id) {
    await deleteIncome(existing[0].txn_id);
    await recompute();
  }
  return ok(null, "RA receipt updated");
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid RA receipt id", 400);
  const existing = await query<{ txn_id: number | null }>("SELECT txn_id FROM ra_receipts WHERE id = ?", [id]);
  if (!existing.length) return fail("RA receipt not found", 404);

  // Gather the income transactions of this receipt's payments (and any legacy receipt txn)
  // before deleting — the payments rows are removed by ON DELETE CASCADE.
  const payTxns = await query<{ txn_id: number | null }>(
    "SELECT txn_id FROM ra_payments WHERE receipt_id = ? AND txn_id IS NOT NULL",
    [id]
  );
  await pool.query("DELETE FROM ra_receipts WHERE id = ?", [id]);

  const txnIds = [existing[0].txn_id, ...payTxns.map((p) => p.txn_id)].filter((t): t is number => !!t);
  for (const t of txnIds) await deleteIncome(t);
  if (txnIds.length) await recompute();

  return ok(null, "RA receipt deleted");
}
