import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { raPaymentSchema, parseId, zErr } from "@/lib/validation";
import { postIncome, recompute } from "@/lib/raTxn";

// Payments recorded against one RA receipt, oldest first.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return fail("Invalid RA receipt id", 400);
  const rows = await query(
    `SELECT pay.id, DATE_FORMAT(pay.txn_date, '%Y-%m-%d') AS txn_date, pay.amount,
            pay.account_id, a.name AS account_name, pay.note
       FROM ra_payments pay
       LEFT JOIN accounts a ON a.id = pay.account_id
      WHERE pay.receipt_id = ?
      ORDER BY pay.txn_date ASC, pay.id ASC`,
    [id]
  );
  return ok(rows, "Payments fetched");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid RA receipt id", 400);
  const parsed = raPaymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const d = parsed.data;

  // Inherit the receipt's site + party so the credited income is tagged consistently.
  const r = await query<{ project_id: number | null; paid_to: string | null; net_receivable: number }>(
    "SELECT project_id, paid_to, net_receivable FROM ra_receipts WHERE id = ?",
    [id]
  );
  if (!r.length) return fail("RA receipt not found", 404);

  // Server-side over-payment guard: the new payment must not push total received past the
  // Net Receivable snapshot. Compared in integer paisa to avoid float drift.
  const paidRow = await query<{ paid: number }>(
    "SELECT COALESCE(SUM(amount),0) AS paid FROM ra_payments WHERE receipt_id = ?",
    [id]
  );
  const toPaisa = (n: number) => Math.round(Number(n) * 100);
  const balance = toPaisa(r[0].net_receivable) - toPaisa(paidRow[0].paid);
  if (balance <= 0) return fail("This bill is already fully received.");
  if (toPaisa(d.amount) > balance) {
    return fail(`Amount can't exceed the balance due (₹${(balance / 100).toLocaleString("en-IN")}).`);
  }

  const txnId = await postIncome({
    txn_date: d.txn_date,
    project_id: r[0].project_id,
    account_id: d.account_id ?? null,
    paid_to: r[0].paid_to,
    amount: d.amount,
    note: d.note || "RA bill payment",
  });
  const [res]: any = await pool.query(
    "INSERT INTO ra_payments (receipt_id, txn_date, amount, account_id, note, txn_id) VALUES (?, ?, ?, ?, ?, ?)",
    [id, d.txn_date, d.amount, d.account_id || null, d.note || null, txnId]
  );
  if (txnId) await recompute();
  return ok({ id: res.insertId }, "Payment added", {}, 201);
}
