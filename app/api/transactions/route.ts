import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { accountEffects } from "@/lib/ledger";
import { ok, fail } from "@/lib/api";

const TYPES = ["transfer", "expense", "income", "partner_contribution", "partner_withdrawal"];

const SELECT = `
  SELECT t.*,
    sa.name AS source_name, sa.account_type AS source_type,
    da.name AS dest_name, da.account_type AS dest_type,
    p.name AS project_name
  FROM transactions t
  LEFT JOIN accounts sa ON sa.id = t.source_account_id
  LEFT JOIN accounts da ON da.id = t.dest_account_id
  LEFT JOIN projects p ON p.id = t.project_id`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") || 50)), 200);
  const where: string[] = [];
  const args: any[] = [];

  if (searchParams.get("project_id")) {
    where.push("t.project_id = ?");
    args.push(searchParams.get("project_id"));
  }
  if (searchParams.get("type")) {
    where.push("t.type = ?");
    args.push(searchParams.get("type"));
  }
  if (searchParams.get("from")) {
    where.push("t.txn_date >= ?");
    args.push(searchParams.get("from"));
  }
  if (searchParams.get("to")) {
    where.push("t.txn_date <= ?");
    args.push(searchParams.get("to"));
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Pagination: ?page=1&limit=50 (limit capped at 200). `page` defaults to 1.
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const offset = (page - 1) * limit;

  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM transactions t ${whereSql}`,
    args
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  const rows = await query(
    `${SELECT} ${whereSql} ORDER BY t.txn_date DESC, t.id DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  );

  return ok(rows, rows.length ? "Transactions fetched successfully" : "No transactions found", {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
}

export async function POST(req: NextRequest) {
  await ready();
  const b = await req.json();
  const type = b.type;
  const amount = Number(b.amount);
  const S = b.source_account_id ? Number(b.source_account_id) : null;
  const D = b.dest_account_id ? Number(b.dest_account_id) : null;
  const P = b.project_id ? Number(b.project_id) : null;
  const txnDate = b.txn_date || new Date().toLocaleDateString("en-CA");
  let category: string | null = b.category || null;

  if (!TYPES.includes(type)) return fail("Invalid type");
  if (!amount || amount <= 0) return fail("Amount must be greater than 0");

  // Per-type validation
  if (type === "transfer") {
    if (!S) return fail("Source account is required");
    if (!D && !P) return fail("Destination account or project is required");
    if (D && D === S) return fail("Source and destination must be different");
    category = null;
  } else if (type === "expense") {
    if (!category) return fail("Category is required");
    const known = await query("SELECT 1 FROM categories WHERE name = ? LIMIT 1", [category]);
    if (!known.length) return fail("Unknown category");
    if (!P && !S) return fail("Project (site) or account is required");
  } else if (type === "income") {
    if (!D && !P) return fail("Destination account or project is required");
    category = null;
  } else if (type === "partner_contribution") {
    if (!S) return fail("Partner account is required");
    category = null;
  } else if (type === "partner_withdrawal") {
    if (!S) return fail("Source account is required");
    if (!D) return fail("Partner account is required");
    category = null;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res]: any = await conn.query(
      `INSERT INTO transactions
        (type, txn_date, project_id, source_account_id, dest_account_id, amount, category, paid_to, note, receipt_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, txnDate, P, S, D, amount, category, b.paid_to || null, b.note || null, b.receipt_url || null]
    );

    // Apply the canonical balance effects (shared with the reconciler in lib/ledger).
    // Site funds (project received/spent) are DERIVED, so only real accounts are touched.
    for (const e of accountEffects({ type, amount, source_account_id: S, dest_account_id: D })) {
      await conn.query("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", [
        e.delta,
        e.accountId,
      ]);
    }

    await conn.commit();
    return ok({ id: res.insertId }, "Transaction saved", {}, 201);
  } catch (e: any) {
    await conn.rollback();
    return fail(e.message || "Something went wrong", 500);
  } finally {
    conn.release();
  }
}
