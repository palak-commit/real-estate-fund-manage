import { NextRequest } from "next/server";
import { pool, ready } from "@/lib/db";
import { accountEffects, toPaisa } from "@/lib/ledger";
import { RECEIVED_SQL, SPENT_SQL, SITE_OUT_SQL, SITE_XFER_OUT_SQL } from "@/lib/queries";
import { inr } from "@/lib/format";
import { ok, fail } from "@/lib/api";
import { parseId, txnEditSchema, zErr } from "@/lib/validation";
import { logActivity, describeTxn, txnDetail } from "@/lib/activity";

// Edit a transaction's NON-financial fields only (date, paid-to, note, and — for expenses —
// category). Amount/type/accounts are immutable here, so this never moves money or touches a
// balance. To change a financial field, delete the row and re-create it.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid transaction id", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }
  const parsed = txnEditSchema.safeParse(body);
  if (!parsed.success) return fail(zErr(parsed.error));
  const b = parsed.data;

  const [rows]: any = await pool.query(
    "SELECT id, type, project_id, dest_account_id, category_id FROM transactions WHERE id = ? LIMIT 1",
    [id]
  );
  const txn = rows[0];
  if (!txn) return fail("Transaction not found", 404);

  // Category only applies to expenses. For other types we leave the existing value as-is.
  // Validate the supplied id resolves (head or sub-head) so the FK can't be set to a bogus value.
  let categoryId: number | null = txn.category_id ?? null;
  if (txn.type === "expense") {
    categoryId = null;
    if (b.category_id) {
      const [cat]: any = await pool.query("SELECT id FROM categories WHERE id = ? LIMIT 1", [b.category_id]);
      if (!cat[0]) return fail("Category not found", 400);
      categoryId = cat[0].id;
    }
  }

  await pool.query(
    "UPDATE transactions SET txn_date = ?, category_id = ?, paid_to = ?, note = ? WHERE id = ?",
    [b.txn_date, categoryId, b.paid_to || null, b.note || null, id]
  );

  await logActivity({
    action: "updated",
    entity: "transaction",
    entityId: id,
    projectId: txn.project_id ?? null,
    title: `${describeTxn(txn.type, { hasProject: txn.project_id != null, hasDest: txn.dest_account_id != null })} edited`,
    meta: { type: txn.type, note: b.note || null, paid_to: b.paid_to || null },
  });

  return ok(null, "Transaction updated");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid transaction id", 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the row so its effects can't change while we reverse them.
    const [rows]: any = await conn.query(
      "SELECT id, type, amount, project_id, dest_project_id, source_account_id, dest_account_id FROM transactions WHERE id = ? FOR UPDATE",
      [id]
    );
    const txn = rows[0];
    if (!txn) {
      await conn.rollback();
      return fail("Transaction not found", 404);
    }

    // Site→site fund transfer: a linked pair (an OUT `transfer` on the source site + an IN
    // `income` on the destination site, both with a dest_project_id and no accounts). Delete
    // BOTH legs together, guarding that the destination site's funds aren't already spent.
    const isXferOut = txn.type === "transfer" && txn.source_account_id == null && txn.dest_account_id == null && txn.dest_project_id != null;
    const isXferIn = txn.type === "income" && txn.dest_account_id == null && txn.dest_project_id != null;
    if (isXferOut || isXferIn) {
      // The site that RECEIVED the funds (whose balance would drop when we reverse).
      const destSite = isXferOut ? txn.dest_project_id : txn.project_id;
      const [balRows]: any = await conn.query(
        `SELECT p.name, (${RECEIVED_SQL} - ${SPENT_SQL} - ${SITE_OUT_SQL} - ${SITE_XFER_OUT_SQL}) AS bal
           FROM projects p LEFT JOIN transactions t ON t.project_id = p.id WHERE p.id = ? GROUP BY p.id, p.name`,
        [destSite]
      );
      const bal = Number(balRows[0]?.bal || 0);
      if (toPaisa(bal) < toPaisa(Number(txn.amount))) {
        await conn.rollback();
        return fail(
          `Cannot delete — ${balRows[0]?.name ?? "the receiving site"} only has ${inr(bal)} of site funds left, but this transfer added ${inr(Number(txn.amount))}. That money has already been spent; delete the dependent expenses first.`
        );
      }
      // Find the paired leg (opposite type, mirrored project/dest_project, same amount): the
      // partner's project_id is this row's dest_project_id and vice-versa.
      const partnerType = isXferOut ? "income" : "transfer";
      const [partner]: any = await conn.query(
        `SELECT id FROM transactions
          WHERE type = ? AND project_id = ? AND dest_project_id = ? AND amount = ?
            AND source_account_id IS NULL AND dest_account_id IS NULL AND id <> ?
          LIMIT 1 FOR UPDATE`,
        [partnerType, txn.dest_project_id, txn.project_id, txn.amount, id]
      );
      const partnerId = partner[0]?.id ?? null;
      await conn.query("DELETE FROM transactions WHERE id = ?", [id]);
      if (partnerId) await conn.query("DELETE FROM transactions WHERE id = ?", [partnerId]);
      await logActivity(
        {
          action: "deleted",
          entity: "transaction",
          entityId: id,
          projectId: txn.project_id ?? null,
          title: "Site fund transfer deleted",
          amount: Number(txn.amount),
          meta: { type: "transfer", site_transfer: true },
        },
        conn
      );
      await conn.commit();
      return ok(null, "Transaction deleted");
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

    // Resolve names before the row is gone, for a readable activity detail line.
    const [nm]: any = await conn.query(
      `SELECT (SELECT name FROM accounts WHERE id = ?) AS source_name,
              (SELECT name FROM accounts WHERE id = ?) AS dest_name,
              (SELECT name FROM projects WHERE id = ?) AS project_name`,
      [txn.source_account_id, txn.dest_account_id, txn.project_id]
    );
    const detail = txnDetail({
      type: txn.type,
      source_name: nm[0]?.source_name,
      dest_name: nm[0]?.dest_name,
      project_name: nm[0]?.project_name,
    });

    await conn.query("DELETE FROM transactions WHERE id = ?", [id]);

    await logActivity(
      {
        action: "deleted",
        entity: "transaction",
        entityId: id,
        projectId: txn.project_id ?? null,
        title: `${describeTxn(txn.type, { hasProject: txn.project_id != null, hasDest: txn.dest_account_id != null })} deleted`,
        amount: Number(txn.amount),
        meta: { type: txn.type, detail },
      },
      conn
    );

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
