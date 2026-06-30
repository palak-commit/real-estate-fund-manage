import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL } from "@/lib/queries";
import { accountEffects, toPaisa } from "@/lib/ledger";
import { inr } from "@/lib/format";
import { ok, fail } from "@/lib/api";
import { txnCreateSchema, zErr } from "@/lib/validation";
import { logActivity, describeTxn, txnDetail } from "@/lib/activity";

const SELECT = `
  SELECT t.*,
    sa.name AS source_name, sa.account_type AS source_type,
    da.name AS dest_name, da.account_type AS dest_type,
    p.name AS project_name,
    CASE WHEN c.parent_id IS NOT NULL THEN c.name END AS category,
    COALESCE(pc.name, c.name) AS category_head
  FROM transactions t
  LEFT JOIN accounts sa ON sa.id = t.source_account_id
  LEFT JOIN accounts da ON da.id = t.dest_account_id
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN categories pc ON pc.id = c.parent_id`;

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
    const t = searchParams.get("type")!;
    // `income` and `funds_added` are the same DB type, split by whether a site is tagged:
    // income earned FROM a site (has project_id) vs plain outside money added to an account.
    if (t === "income") {
      where.push("t.type = 'income' AND t.project_id IS NOT NULL");
    } else if (t === "funds_added") {
      where.push("t.type = 'income' AND t.project_id IS NULL");
    } else {
      where.push("t.type = ?");
      args.push(t);
    }
  }
  // `head` = the category Head (matches any expense whose sub-head rolls up to it).
  // `category` = a specific Sub-Head (leaf) name.
  if (searchParams.get("head")) {
    where.push("pc.name = ?");
    args.push(searchParams.get("head"));
  }
  if (searchParams.get("category")) {
    where.push("c.name = ?");
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
    `SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS amount
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN categories pc ON pc.id = c.parent_id ${whereSql}`,
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
  const b = await req.json().catch(() => null);
  if (!b) return fail("Invalid request body");

  // Shape/type guard (type is one of the enum values, amount is a positive number).
  const parsed = txnCreateSchema.safeParse(b);
  if (!parsed.success) return fail(zErr(parsed.error));
  const { type, amount } = parsed.data;

  const S = b.source_account_id ? Number(b.source_account_id) : null;
  const D = b.dest_account_id ? Number(b.dest_account_id) : null;
  const P = b.project_id ? Number(b.project_id) : null;
  const txnDate = b.txn_date || new Date().toLocaleDateString("en-CA");
  let categoryId: number | null = null;
  let categoryName: string | null = null;

  // Per-type validation
  if (type === "transfer") {
    if (!S) return fail("Source account is required");
    if (!D && !P) return fail("Destination account or project is required");
    if (D && D === S) return fail("Source and destination must be different");
  } else if (type === "expense") {
    // Expenses are tagged to a Head, optionally narrowed to one of its Sub-Heads (Type of
    // Head). Prefer category_id; fall back to a name lookup for legacy callers. The category
    // can be a Head (head-only) or a Sub-Head — the Type of Head is optional.
    let cat: { id: number; name: string; parent_id: number | null } | undefined;
    if (b.category_id) {
      const rows = await query<{ id: number; name: string; parent_id: number | null }>(
        "SELECT id, name, parent_id FROM categories WHERE id = ? LIMIT 1",
        [Number(b.category_id)]
      );
      cat = rows[0];
    } else if (b.category) {
      const rows = await query<{ id: number; name: string; parent_id: number | null }>(
        "SELECT id, name, parent_id FROM categories WHERE name = ? LIMIT 1",
        [b.category]
      );
      cat = rows[0];
    } else {
      return fail("Category is required");
    }
    if (!cat) return fail("Unknown category");
    categoryId = cat.id;
    categoryName = cat.name;
    if (!P && !S) return fail("Project (site) or account is required");
  } else if (type === "income") {
    if (!D && !P) return fail("Destination account or project is required");
  } else if (type === "partner_contribution") {
    if (!S) return fail("Partner account is required");
  } else if (type === "partner_withdrawal") {
    if (!S) return fail("Partner account is required");
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
        if (toPaisa(bal) + toPaisa(e.delta) < 0) {
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
      if (toPaisa(bal) < toPaisa(amount)) {
        await conn.rollback();
        return fail(`Insufficient site funds — only ${inr(bal)} available. Add funds to the site first.`);
      }
    }

    const [res]: any = await conn.query(
      `INSERT INTO transactions
        (type, txn_date, project_id, source_account_id, dest_account_id, amount, category_id, paid_to, note, receipt_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, txnDate, P, S, D, amount, categoryId, b.paid_to || null, b.note || null, b.receipt_url || null]
    );

    // Apply the canonical balance effects (shared with the reconciler in lib/ledger).
    // Site funds (project received/spent) are DERIVED, so only real accounts are touched.
    for (const e of effects) {
      await conn.query("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", [
        e.delta,
        e.accountId,
      ]);
    }

    // Resolve the account/site names so the activity feed can show a readable detail line.
    const [nm]: any = await conn.query(
      `SELECT (SELECT name FROM accounts WHERE id = ?) AS source_name,
              (SELECT name FROM accounts WHERE id = ?) AS dest_name,
              (SELECT name FROM projects WHERE id = ?) AS project_name`,
      [S, D, P]
    );
    const detail = txnDetail({
      type,
      source_name: nm[0]?.source_name,
      dest_name: nm[0]?.dest_name,
      project_name: nm[0]?.project_name,
      category: categoryName || b.category || null,
      paid_to: b.paid_to || null,
    });

    await logActivity(
      {
        action: "created",
        entity: "transaction",
        entityId: res.insertId,
        title: describeTxn(type, { hasProject: !!P, hasDest: !!D }),
        amount,
        meta: { type, detail, note: b.note || null, paid_to: b.paid_to || null },
      },
      conn
    );

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
