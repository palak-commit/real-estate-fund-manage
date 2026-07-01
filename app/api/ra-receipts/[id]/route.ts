import { NextRequest } from "next/server";
import { z } from "zod";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { raReceiptSchema, parseId, zErr } from "@/lib/validation";
import { deleteIncome, recompute, incomeReversalBlock } from "@/lib/raTxn";
import { netReceivableFrom } from "@/lib/ra";
import { logActivity } from "@/lib/activity";

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

  // Guard: the edited Net Receivable can't drop below what's already been received against
  // this bill — that would leave an impossible state (paid more than the bill is worth) and
  // break the over-payment math in /payments. Compared in integer paisa to avoid float drift.
  const net = netReceivableFrom(d, d.rates); // server-computed, not the client-sent value
  const paidRow = await query<{ paid: number }>(
    "SELECT COALESCE(SUM(amount),0) AS paid FROM ra_payments WHERE receipt_id = ?",
    [id]
  );
  const paid = Number(paidRow[0]?.paid || 0);
  const toPaisa = (n: number) => Math.round(n * 100);
  if (toPaisa(net) < toPaisa(paid)) {
    return fail(
      `Net Receivable (₹${net.toLocaleString("en-IN")}) can't be less than the ₹${paid.toLocaleString("en-IN")} already received. Remove or reduce its payments first.`
    );
  }

  const raRatesJson = d.rates ? JSON.stringify(d.rates) : null;
  await pool.query(
    `UPDATE ra_receipts
        SET txn_date = ?, project_id = ?, account_id = ?, paid_to = ?, amount = ?,
            withheld_amt = ?, royalty = ?, agency_charge = ?, sub_let_bill = ?, net_receivable = ?, ra_rates = ?, note = ?, status = ?, txn_id = NULL
      WHERE id = ?`,
    [d.txn_date || null, d.project_id || null, d.account_id || null, d.paid_to || null, d.amount,
     d.withheld_amt, d.royalty, d.agency_charge, d.sub_let_bill, net, raRatesJson, d.note || null, d.status, id]
  );

  // Remember this rate set as the site's latest, so new receipts for the site default to it.
  if (d.project_id && raRatesJson) {
    await pool.query("UPDATE projects SET ra_rates = ? WHERE id = ?", [raRatesJson, d.project_id]);
  }

  // Drop any legacy receipt-level income (old full-Net-Receivable behaviour) — money now
  // lives only on the partial payments.
  if (existing[0].txn_id) {
    await deleteIncome(existing[0].txn_id);
    await recompute();
  }
  await logActivity({
    action: "updated",
    entity: "ra_receipt",
    entityId: id,
    title: `RA receipt updated${d.paid_to ? ` · ${d.paid_to}` : ""}`,
    amount: d.amount,
    meta: { status: d.status },
  });
  return ok(null, "RA receipt updated");
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid RA receipt id", 400);
  const existing = await query<{ txn_id: number | null; amount: number; paid_to: string | null }>(
    "SELECT txn_id, amount, paid_to FROM ra_receipts WHERE id = ?",
    [id]
  );
  if (!existing.length) return fail("RA receipt not found", 404);

  // Gather the income transactions of this receipt's payments (and any legacy receipt txn)
  // before deleting — the payments rows are removed by ON DELETE CASCADE.
  const payTxns = await query<{ txn_id: number | null }>(
    "SELECT txn_id FROM ra_payments WHERE receipt_id = ? AND txn_id IS NOT NULL",
    [id]
  );
  const txnIds = [existing[0].txn_id, ...payTxns.map((p) => p.txn_id)].filter((t): t is number => !!t);

  // Refuse if reversing the credited income would push an account negative (its money was
  // already spent — e.g. paid out via vendor bills). Checked BEFORE anything is deleted.
  const block = await incomeReversalBlock(txnIds);
  if (block) return fail(block);

  await pool.query("DELETE FROM ra_receipts WHERE id = ?", [id]);

  for (const t of txnIds) await deleteIncome(t);
  if (txnIds.length) await recompute();

  await logActivity({
    action: "deleted",
    entity: "ra_receipt",
    entityId: id,
    title: `RA receipt deleted${existing[0].paid_to ? ` · ${existing[0].paid_to}` : ""}`,
    amount: existing[0].amount ?? null,
  });
  return ok(null, "RA receipt deleted");
}
