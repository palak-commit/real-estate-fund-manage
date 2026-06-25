import { NextRequest } from "next/server";
import { pool, ready } from "@/lib/db";
import { accountEffects, toPaisa } from "@/lib/ledger";
import { inr } from "@/lib/format";
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
      "SELECT id, type, amount, project_id, source_account_id, dest_account_id FROM transactions WHERE id = ? FOR UPDATE",
      [id]
    );
    const txn = rows[0];
    if (!txn) {
      await conn.rollback();
      return fail("Transaction not found", 404);
    }

    // Guard: this is money INTO a site ("Add Site Fund" / income-to-site). Those funds
    // pay the site's expenses, so refuse to delete while dependent (site-funded) expenses
    // still exist — the owner must delete or move those expenses first.
    const isSiteInflow =
      txn.project_id != null &&
      (txn.type === "transfer" || txn.type === "income") &&
      txn.dest_account_id == null;
    if (isSiteInflow) {
      const [dep]: any = await conn.query(
        `SELECT COUNT(*) AS c FROM transactions
          WHERE project_id = ? AND type = 'expense' AND source_account_id IS NULL`,
        [txn.project_id]
      );
      const n = Number(dep[0]?.c || 0);
      if (n > 0) {
        await conn.rollback();
        return fail(
          `Cannot delete — this site fund has ${n} dependent ${n === 1 ? "expense" : "expenses"}. Delete or move those expenses first.`
        );
      }
    }

    const effects = accountEffects(txn);

    // Universal funds guard: deleting reverses this transaction's effects. If the money it
    // brought INTO an account has since been used, reversing it would push that account
    // negative — meaning dependent transactions rely on it. Refuse rather than corrupt
    // balances. (Credits are the money-in side; reversing them subtracts from the account.)
    const credits = effects.filter((e) => e.delta > 0);
    if (credits.length) {
      const ids = credits.map((e) => e.accountId);
      const [accRows]: any = await conn.query(
        `SELECT id, name, current_balance FROM accounts WHERE id IN (${ids.map(() => "?").join(",")}) FOR UPDATE`,
        ids
      );
      const byId = new Map<number, any>(accRows.map((a: any) => [a.id, a]));
      for (const e of credits) {
        const a = byId.get(e.accountId);
        const bal = Number(a?.current_balance ?? 0);
        if (toPaisa(bal) < toPaisa(e.delta)) {
          await conn.rollback();
          return fail(
            `Cannot delete — ${a?.name ?? "the account"} only has ${inr(bal)} left, but this added ${inr(e.delta)}. That money has already been used; delete the dependent transactions first.`
          );
        }
      }
    }

    // Reverse ONLY the accounts this transaction touched (the inverse of the canonical
    // accountEffects used on the write path) instead of replaying the entire ledger.
    // Site funds are derived (lib/queries), so deleting the row updates them for free.
    for (const e of effects) {
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
