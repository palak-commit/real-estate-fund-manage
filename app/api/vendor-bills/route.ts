import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { vendorBillSchema, zErr } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

// Each row carries its site + Head names, the persisted total owed, and `paid` (SUM of its
// payments) so the register can show the balance due without trusting the client.
const SELECT = `SELECT b.id, DATE_FORMAT(b.txn_date, '%Y-%m-%d') AS txn_date,
    b.project_id, p.name AS project_name,
    b.category_id, CASE WHEN c.parent_id IS NOT NULL THEN c.name END AS category,
    COALESCE(pc.name, c.name) AS category_head,
    b.paid_to, b.amount, b.gst, b.total_bill, b.note, b.status, b.payment_type,
    (SELECT COALESCE(SUM(amount),0) FROM vendor_payments WHERE bill_id = b.id) AS paid,
    -- The advance = the first payment recorded (only meaningful for 'advance' bills); the rest
    -- of the payments are the later installments.
    (SELECT vp.amount FROM vendor_payments vp WHERE vp.bill_id = b.id
       ORDER BY vp.txn_date ASC, vp.id ASC LIMIT 1) AS advance,
    (SELECT COUNT(*) FROM vendor_payments WHERE bill_id = b.id) AS payment_count
  FROM vendor_bills b
  LEFT JOIN projects p ON p.id = b.project_id
  LEFT JOIN categories c ON c.id = b.category_id
  LEFT JOIN categories pc ON pc.id = c.parent_id`;

// Undated rows sort last, then by date, then by insertion order — matching the sheet.
export async function GET() {
  const rows = await query(`${SELECT} ORDER BY (b.txn_date IS NULL), b.txn_date, b.id`);
  return ok(rows, "Vendor bills fetched");
}

export async function POST(req: NextRequest) {
  await ready();
  const parsed = vendorBillSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const d = parsed.data;

  // A new vendor bill is a NEW commitment on the site — only Active sites accept one.
  // (Editing/paying an EXISTING bill on a locked site is still allowed, so outstanding
  // payables can be settled after a site is put On Hold / Completed.)
  if (d.project_id) {
    const rows = await query<{ name: string; status: string }>(
      "SELECT name, status FROM projects WHERE id = ? LIMIT 1",
      [d.project_id]
    );
    if (rows[0] && rows[0].status !== "active") {
      const label = rows[0].status === "completed" ? "Completed" : "On Hold";
      return fail(`"${rows[0].name}" is ${label}. Reactivate the site to add a new vendor bill.`);
    }
  }

  // Total owed is computed server-side; the client value isn't trusted.
  const total = Math.round((d.amount + d.gst) * 100) / 100;

  const [res]: any = await pool.query(
    `INSERT INTO vendor_bills (txn_date, project_id, category_id, paid_to, amount, gst, total_bill, note, status, payment_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.txn_date || null, d.project_id, d.category_id || null, d.paid_to || null, d.amount, d.gst, total, d.note || null, d.status, d.payment_type]
  );

  await logActivity({
    action: "created",
    entity: "vendor_bill",
    entityId: res.insertId,
    projectId: d.project_id ?? null,
    title: `Vendor bill added${d.paid_to ? ` · ${d.paid_to}` : ""}${d.payment_type === "advance" ? " (advance)" : ""}`,
    amount: total,
    meta: { total_bill: total, status: d.status, payment_type: d.payment_type },
  });
  return ok({ id: res.insertId }, "Vendor bill added", {}, 201);
}
