import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL } from "@/lib/queries";
import { accountEffects } from "@/lib/ledger";
import { inr } from "@/lib/format";
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
  if (searchParams.get("category")) {
    where.push("t.category = ?");
    args.push(searchParams.get("category"));
  }
  if (searchParams.get("paid_to")) {
    where.push("t.paid_to = ?");
    args.push(searchParams.get("paid_to"));
  }
  if (searchParams.get("account")) {
    // Matches the account as either source or destination.
    where.push("(t.source_account_id = ? OR t.dest_account_id = ?)");
    args.push(searchParams.get("account"), searchParams.get("account"));
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

  // Count + summed amount over the full filtered set (not just the current page).
  const aggRows = await query<{ total: number; amount: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS amount FROM transactions t ${whereSql}`,
    args
  );
  const total = Number(aggRows[0]?.total || 0);
  const amount = Number(aggRows[0]?.amount || 0);
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
    summary: { count: total, amount },
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
    if (!S) return fail("Partner account is required");
    category = null;
  }

  const effects = accountEffects({ type, amount, source_account_id: S, dest_account_id: D });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Funds guard: no account may go negative. Lock the debited rows, then verify.
    const debits = effects.filter((e) => e.delta < 0);
    if (debits.length) {
      const ids = debits.map((e) => e.accountId);
      const [accRows]: any = await conn.query(
        `SELECT id, name, current_balance FROM accounts WHERE id IN (${ids.map(() => "?").join(",")}) FOR UPDATE`,
        ids
      );
      const byId = new Map<number, any>(accRows.map((a: any) => [a.id, a]));
      for (const e of debits) {
        const a = byId.get(e.accountId);
        const bal = Number(a?.current_balance ?? 0);
        if (bal + e.delta < -0.005) {
          await conn.rollback();
          return fail(`Insufficient balance — ${a?.name ?? "account"} has only ${inr(bal)} available`);
        }
      }
    }

    // Site-funded expense (no source account): the site's own funds must cover it.
    if (type === "expense" && !S && P) {
      const [siteRows]: any = await conn.query(
        `SELECT (${RECEIVED_SQL} - ${SPENT_SQL}) AS bal FROM transactions t WHERE t.project_id = ?`,
        [P]
      );
      const bal = Number(siteRows[0]?.bal || 0);
      if (bal + 0.005 < amount) {
        await conn.rollback();
        return fail(`Insufficient site funds — only ${inr(bal)} available. Allocate more funds first.`);
      }
    }

    const [res]: any = await conn.query(
      `INSERT INTO transactions
        (type, txn_date, project_id, source_account_id, dest_account_id, amount, category, paid_to, note, receipt_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, txnDate, P, S, D, amount, category, b.paid_to || null, b.note || null, b.receipt_url || null]
    );

    // Apply the canonical balance effects (shared with the reconciler in lib/ledger).
    // Site funds (project received/spent) are DERIVED, so only real accounts are touched.
    for (const e of effects) {
      await conn.query("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", [
        e.delta,
        e.accountId,
      ]);
    }

    await conn.commit();
    return ok({ id: res.insertId }, "Transaction saved", {}, 201);
  } catch (e: any) {
    await conn.rollback();
    console.error("POST /api/transactions failed:", e);
    return fail("Something went wrong. Please try again.", 500);
  } finally {
    conn.release();
  }
}
