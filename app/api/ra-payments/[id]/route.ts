import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { parseId } from "@/lib/validation";
import { deleteIncome, recompute } from "@/lib/raTxn";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid payment id", 400);
  const existing = await query<{ txn_id: number | null }>("SELECT txn_id FROM ra_payments WHERE id = ?", [id]);
  if (!existing.length) return fail("Payment not found", 404);

  await pool.query("DELETE FROM ra_payments WHERE id = ?", [id]);
  if (existing[0].txn_id) {
    await deleteIncome(existing[0].txn_id);
    await recompute();
  }
  return ok(null, "Payment deleted");
}
