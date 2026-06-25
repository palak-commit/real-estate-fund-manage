import { NextRequest } from "next/server";
import { pool, ready } from "@/lib/db";
import { accountEffects } from "@/lib/ledger";
import { ok, fail } from "@/lib/api";
import { parseId } from "@/lib/validation";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid transaction id", 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the row so its effects can't change while we reverse them.
    const [rows]: any = await conn.query(
      "SELECT id, type, amount, source_account_id, dest_account_id FROM transactions WHERE id = ? FOR UPDATE",
      [id]
    );
    const txn = rows[0];
    if (!txn) {
      await conn.rollback();
      return fail("Transaction not found", 404);
    }

    // Reverse ONLY the accounts this transaction touched (the inverse of the canonical
    // accountEffects used on the write path) instead of replaying the entire ledger.
    // Site funds are derived (lib/queries), so deleting the row updates them for free.
    for (const e of accountEffects(txn)) {
      await conn.query(
        "UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?",
        [e.delta, e.accountId]
      );
    }

    await conn.query("DELETE FROM transactions WHERE id = ?", [id]);
    await conn.commit();
    return ok(null, "Transaction deleted");
  } catch (e) {
    await conn.rollback();
    console.error("DELETE /api/transactions/[id] failed:", e);
    return fail("Something went wrong. Please try again.", 500);
  } finally {
    conn.release();
  }
}
