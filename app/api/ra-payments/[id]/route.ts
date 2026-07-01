import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { parseId } from "@/lib/validation";
import { deleteIncome, recompute, incomeReversalBlock } from "@/lib/raTxn";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid payment id", 400);
  const existing = await query<{ txn_id: number | null }>("SELECT txn_id FROM ra_payments WHERE id = ?", [id]);
  if (!existing.length) return fail("Payment not found", 404);

  // Refuse if reversing this payment's credited income would push its account negative
  // (that money has already been spent elsewhere). Checked before anything is deleted.
  if (existing[0].txn_id) {
    const block = await incomeReversalBlock([existing[0].txn_id]);
    if (block) return fail(block);
  }

  await pool.query("DELETE FROM ra_payments WHERE id = ?", [id]);
  if (existing[0].txn_id) {
    await deleteIncome(existing[0].txn_id);
    await recompute();
  }
  return ok(null, "Payment deleted");
}
