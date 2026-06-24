import { NextRequest } from "next/server";
import { pool, ready } from "@/lib/db";
import { recomputeBalances } from "@/lib/ledger";
import { ok, fail } from "@/lib/api";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await params;
  const [res]: any = await pool.query("DELETE FROM transactions WHERE id = ?", [id]);
  if (!res.affectedRows) return fail("Transaction not found", 404);
  // Site funds are derived; account balances are recomputed from the remaining ledger.
  await recomputeBalances(true);
  return ok(null, "Transaction deleted");
}
