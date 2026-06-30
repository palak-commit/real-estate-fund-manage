import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { raReceiptSchema, zErr } from "@/lib/validation";
import { postIncome, recompute } from "@/lib/raTxn";
import { logActivity } from "@/lib/activity";

const SELECT = `SELECT r.id, DATE_FORMAT(r.txn_date, '%Y-%m-%d') AS txn_date,
    r.project_id, p.name AS project_name, r.account_id, a.name AS account_name, r.paid_to,
    r.amount, r.withheld_amt, r.royalty, r.agency_charge, r.sub_let_bill, r.net_receivable, r.note, r.status,
    (SELECT COALESCE(SUM(amount),0) FROM ra_payments WHERE receipt_id = r.id) AS paid
  FROM ra_receipts r
  LEFT JOIN projects p ON p.id = r.project_id
  LEFT JOIN accounts a ON a.id = r.account_id`;

// Undated rows sort last, then by date, then by insertion order — matching the sheet.
export async function GET() {
  const rows = await query(`${SELECT} ORDER BY (r.txn_date IS NULL), r.txn_date, r.id`);
  return ok(rows, "RA receipts fetched");
}

export async function POST(req: NextRequest) {
  await ready();
  const parsed = raReceiptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const d = parsed.data;
  const net = Number(d.net_receivable) || 0;
  // Money is credited only when the admin marks the bill Complete AND picks a Received In
  // account — that means "received in full now". Pending (even with an account) credits
  // nothing; the account is just a tag and money is tracked via partial payments later.
  const fullyReceived = !!(d.account_id && net > 0 && d.status === "complete");

  const [res]: any = await pool.query(
    `INSERT INTO ra_receipts (txn_date, project_id, account_id, paid_to, amount, withheld_amt, royalty, agency_charge, sub_let_bill, net_receivable, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.txn_date || null, d.project_id || null, d.account_id || null, d.paid_to || null,
     d.amount, d.withheld_amt, d.royalty, d.agency_charge, d.sub_let_bill, net, d.note || null, d.status]
  );
  const receiptId = res.insertId;

  if (fullyReceived) {
    const payDate = d.txn_date || new Date().toISOString().slice(0, 10);
    const txnId = await postIncome({
      txn_date: payDate,
      project_id: d.project_id ?? null,
      account_id: d.account_id ?? null,
      paid_to: d.paid_to ?? null,
      amount: net,
      note: d.note || "RA full receipt",
    });
    await pool.query(
      "INSERT INTO ra_payments (receipt_id, txn_date, amount, account_id, note, txn_id) VALUES (?, ?, ?, ?, ?, ?)",
      [receiptId, payDate, net, d.account_id, "Full receipt on creation", txnId]
    );
    await recompute(); // sync the credited account balance
  }
  await logActivity({
    action: "created",
    entity: "ra_receipt",
    entityId: receiptId,
    title: `RA receipt added${d.paid_to ? ` · ${d.paid_to}` : ""}`,
    amount: d.amount,
    meta: { net_receivable: net, status: d.status, fully_received: fullyReceived },
  });
  return ok({ id: receiptId }, "RA receipt added", {}, 201);
}
