import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { vendorPaymentSchema, parseId, zErr } from "@/lib/validation";
import { postExpense, recompute } from "@/lib/vendorTxn";
import { RECEIVED_SQL, SPENT_SQL } from "@/lib/queries";

// Payments made against one vendor bill, oldest first.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return fail("Invalid vendor bill id", 400);
  const rows = await query(
    `SELECT pay.id, DATE_FORMAT(pay.txn_date, '%Y-%m-%d') AS txn_date, pay.amount,
            pay.account_id, a.name AS account_name, pay.category_id, pay.note
       FROM vendor_payments pay
       LEFT JOIN accounts a ON a.id = pay.account_id
      WHERE pay.bill_id = ?
      ORDER BY pay.txn_date ASC, pay.id ASC`,
    [id]
  );
  return ok(rows, "Payments fetched");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid vendor bill id", 400);
  const parsed = vendorPaymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const d = parsed.data;

  // Inherit the bill's site + vendor + default Head so the posted expense is tagged consistently.
  const b = await query<{ project_id: number; paid_to: string | null; category_id: number | null; total_bill: number }>(
    "SELECT project_id, paid_to, category_id, total_bill FROM vendor_bills WHERE id = ?",
    [id]
  );
  if (!b.length) return fail("Vendor bill not found", 404);

  const toPaisa = (n: number) => Math.round(Number(n) * 100);

  // Over-payment guard: the new payment must not push total paid past the Total Bill.
  const paidRow = await query<{ paid: number }>(
    "SELECT COALESCE(SUM(amount),0) AS paid FROM vendor_payments WHERE bill_id = ?",
    [id]
  );
  const balance = toPaisa(b[0].total_bill) - toPaisa(paidRow[0].paid);
  if (balance <= 0) return fail("This bill is already fully paid.");
  if (toPaisa(d.amount) > balance) {
    return fail(`Amount can't exceed the balance due (₹${(balance / 100).toLocaleString("en-IN")}).`);
  }

  // Funds guard: a payment may not push the paying account (Direct) or the site's funds
  // (paid from site funds) negative — same rule as the transaction POST path.
  if (d.account_id) {
    const accRow = await query<{ bal: number }>("SELECT current_balance AS bal FROM accounts WHERE id = ?", [d.account_id]);
    if (!accRow.length) return fail("Paying account not found", 404);
    if (toPaisa(d.amount) > toPaisa(accRow[0].bal)) {
      return fail(`Not enough balance in that account (₹${Number(accRow[0].bal).toLocaleString("en-IN")} available).`);
    }
  } else {
    // Paid from site funds: site balance = received − site-funded spend, for this project.
    const fundsRow = await query<{ funds: number }>(
      `SELECT (${RECEIVED_SQL} - ${SPENT_SQL}) AS funds FROM transactions t WHERE t.project_id = ?`,
      [b[0].project_id]
    );
    const funds = Number(fundsRow[0]?.funds || 0);
    if (toPaisa(d.amount) > toPaisa(funds)) {
      return fail(`Not enough site funds (₹${funds.toLocaleString("en-IN")} available). Add funds to the site or pay from an account.`);
    }
  }

  const txnId = await postExpense({
    txn_date: d.txn_date,
    project_id: b[0].project_id,
    account_id: d.account_id ?? null,
    category_id: d.category_id ?? b[0].category_id ?? null,
    paid_to: b[0].paid_to,
    amount: d.amount,
    note: d.note || "Vendor bill payment",
  });
  const [res]: any = await pool.query(
    "INSERT INTO vendor_payments (bill_id, txn_date, amount, account_id, category_id, note, txn_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, d.txn_date, d.amount, d.account_id || null, d.category_id ?? b[0].category_id ?? null, d.note || null, txnId]
  );
  if (txnId) await recompute();
  return ok({ id: res.insertId }, "Payment added", {}, 201);
}
