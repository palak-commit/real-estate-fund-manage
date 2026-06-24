import { NextRequest, NextResponse } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { CATEGORIES } from "@/lib/format";

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
  const limit = Math.min(Number(searchParams.get("limit") || 100), 1000);
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

  const rows = await query(
    `${SELECT} ${whereSql} ORDER BY t.txn_date DESC, t.id DESC LIMIT ?`,
    [...args, limit]
  );
  return NextResponse.json(rows);
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

  if (!TYPES.includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (!amount || amount <= 0)
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });

  // Per-type validation
  if (type === "transfer") {
    if (!S) return NextResponse.json({ error: "Source account is required" }, { status: 400 });
    if (!D && !P)
      return NextResponse.json({ error: "Destination account or project is required" }, { status: 400 });
    if (D && D === S)
      return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
    category = null;
  } else if (type === "expense") {
    if (!category || !(CATEGORIES as readonly string[]).includes(category))
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    if (!P && !S)
      return NextResponse.json({ error: "Project (site) or account is required" }, { status: 400 });
  } else if (type === "income") {
    if (!D && !P)
      return NextResponse.json({ error: "Destination account or project is required" }, { status: 400 });
    category = null;
  } else if (type === "partner_contribution") {
    if (!S) return NextResponse.json({ error: "Partner account is required" }, { status: 400 });
    if (!D) return NextResponse.json({ error: "Destination account is required" }, { status: 400 });
    category = null;
  } else if (type === "partner_withdrawal") {
    if (!S) return NextResponse.json({ error: "Source account is required" }, { status: 400 });
    if (!D) return NextResponse.json({ error: "Partner account is required" }, { status: 400 });
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

    const adj = (id: number | null, delta: number) =>
      id
        ? conn.query("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", [
            delta,
            id,
          ])
        : Promise.resolve();

    // Balance-effect engine. Site funds (project received/spent) are DERIVED from
    // transactions, so here we only touch real account balances.
    switch (type) {
      case "transfer":
        await adj(S, -amount);
        if (D) await adj(D, +amount); // else: money becomes site funds of P (derived)
        break;
      case "expense":
        // If a source account is given, money leaves that account (even when tagged to a
        // site for reporting). With no source, the expense draws from the site's funds (derived).
        if (S) await adj(S, -amount);
        break;
      case "income":
        if (D) await adj(D, +amount); // else: income lands as site funds of P (derived)
        break;
      case "partner_contribution":
        // The partner brings in fresh money that lands directly in the chosen account.
        // The partner account is only recorded (source) — its balance is NOT changed.
        await adj(D, +amount); // real account: money in
        break;
      case "partner_withdrawal":
        await adj(S, -amount); // real account: money out
        await adj(D, -amount); // partner account: outstanding down
        break;
    }

    await conn.commit();
    return NextResponse.json({ id: res.insertId }, { status: 201 });
  } catch (e: any) {
    await conn.rollback();
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
