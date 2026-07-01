import { NextRequest } from "next/server";
import { z } from "zod";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { vendorBillSchema, parseId, zErr } from "@/lib/validation";
import { deleteExpense, recompute } from "@/lib/vendorTxn";
import { logActivity } from "@/lib/activity";

// Lightweight status-only update (used when payments auto-set pending/partial/complete).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid vendor bill id", 400);
  const parsed = z.object({ status: z.enum(["pending", "partial", "complete"]) }).safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) return fail(zErr(parsed.error));
  const [res]: any = await pool.query("UPDATE vendor_bills SET status = ? WHERE id = ?", [parsed.data.status, id]);
  if (!res.affectedRows) return fail("Vendor bill not found", 404);
  return ok(null, "Status updated");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid vendor bill id", 400);
  const parsed = vendorBillSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const d = parsed.data;

  const existing = await query<{ id: number }>("SELECT id FROM vendor_bills WHERE id = ?", [id]);
  if (!existing.length) return fail("Vendor bill not found", 404);

  // Guard: the edited Total Bill can't drop below what's already been paid against it — that
  // would leave an impossible state (paid more than the bill is worth) and break the
  // over-payment math in /payments. Compared in integer paisa to avoid float drift.
  const total = Math.round((d.amount + d.gst) * 100) / 100;
  const paidRow = await query<{ paid: number }>(
    "SELECT COALESCE(SUM(amount),0) AS paid FROM vendor_payments WHERE bill_id = ?",
    [id]
  );
  const paid = Number(paidRow[0]?.paid || 0);
  const toPaisa = (n: number) => Math.round(n * 100);
  if (toPaisa(total) < toPaisa(paid)) {
    return fail(
      `Total Bill (₹${total.toLocaleString("en-IN")}) can't be less than the ₹${paid.toLocaleString("en-IN")} already paid. Remove or reduce its payments first.`
    );
  }

  // Status auto-derives from what's actually been paid against the (possibly edited) total —
  // so raising the amount of a fully-paid "advance" bill flips it back to partial, and that
  // new balance reappears on the dashboard Pending Payable card. The client-sent status is
  // ignored here (it's just a payment-derived badge, never set by hand on a bill edit).
  const status = toPaisa(paid) <= 0 ? "pending" : toPaisa(paid) >= toPaisa(total) ? "complete" : "partial";

  await pool.query(
    `UPDATE vendor_bills
        SET txn_date = ?, project_id = ?, category_id = ?, paid_to = ?, amount = ?, gst = ?, total_bill = ?, note = ?, status = ?, payment_type = ?
      WHERE id = ?`,
    [d.txn_date || null, d.project_id, d.category_id || null, d.paid_to || null, d.amount, d.gst, total, d.note || null, status, d.payment_type, id]
  );

  await logActivity({
    action: "updated",
    entity: "vendor_bill",
    entityId: id,
    title: `Vendor bill updated${d.paid_to ? ` · ${d.paid_to}` : ""}${d.payment_type === "advance" ? " (advance)" : ""}`,
    amount: total,
    meta: { status, payment_type: d.payment_type },
  });
  return ok(null, "Vendor bill updated");
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid vendor bill id", 400);
  const existing = await query<{ total_bill: number; paid_to: string | null }>(
    "SELECT total_bill, paid_to FROM vendor_bills WHERE id = ?",
    [id]
  );
  if (!existing.length) return fail("Vendor bill not found", 404);

  // Gather the expense transactions of this bill's payments before deleting — the payment
  // rows themselves are removed by ON DELETE CASCADE. Their `expense` txns must be deleted
  // explicitly (no DB FK) so the spent money is restored to the account/site on recompute.
  const payTxns = await query<{ txn_id: number | null }>(
    "SELECT txn_id FROM vendor_payments WHERE bill_id = ? AND txn_id IS NOT NULL",
    [id]
  );
  await pool.query("DELETE FROM vendor_bills WHERE id = ?", [id]);

  const txnIds = payTxns.map((p) => p.txn_id).filter((t): t is number => !!t);
  for (const t of txnIds) await deleteExpense(t);
  if (txnIds.length) await recompute();

  await logActivity({
    action: "deleted",
    entity: "vendor_bill",
    entityId: id,
    title: `Vendor bill deleted${existing[0].paid_to ? ` · ${existing[0].paid_to}` : ""}`,
    amount: existing[0].total_bill ?? null,
  });
  return ok(null, "Vendor bill deleted");
}
