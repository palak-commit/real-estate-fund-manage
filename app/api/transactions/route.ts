import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SITE_OUT_SQL, SITE_XFER_OUT_SQL } from "@/lib/queries";
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
    dp.name AS dest_project_name,
    CASE WHEN c.parent_id IS NOT NULL THEN c.name END AS category,
    COALESCE(pc.name, c.name) AS category_head,
    vp.bill_id AS bill_id,
    rp.receipt_id AS receipt_id
  FROM transactions t
  LEFT JOIN accounts sa ON sa.id = t.source_account_id
  LEFT JOIN accounts da ON da.id = t.dest_account_id
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN projects dp ON dp.id = t.dest_project_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN categories pc ON pc.id = c.parent_id
  LEFT JOIN vendor_payments vp ON vp.txn_id = t.id
  LEFT JOIN ra_payments rp ON rp.txn_id = t.id`;

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
      // Revenue earned from a site — exclude the incoming leg of a site→site transfer
      // (income tagged with a dest_project_id, which is internal, not earned revenue).
      where.push("t.type = 'income' AND t.project_id IS NOT NULL AND t.dest_project_id IS NULL");
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
    const acc = searchParams.get("account")!;
    if (acc === "site") {
      // "Site Fund" — money drawn from / added to a site's own funds, with no real account
      // involved (site-funded expenses, RA-into-fund, site→site legs).
      where.push("t.source_account_id IS NULL AND t.dest_account_id IS NULL AND t.project_id IS NOT NULL");
    } else {
      // Matches the account as either source or destination.
      where.push("(t.source_account_id = ? OR t.dest_account_id = ?)");
      args.push(acc, acc);
    }
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
  // Destination site for a site→site fund transfer (source site is P, no accounts).
  const DP = b.dest_project_id ? Number(b.dest_project_id) : null;
  const txnDate = b.txn_date || new Date().toLocaleDateString("en-CA");
  let categoryId: number | null = null;
  let categoryName: string | null = null;

  // Per-type validation
  if (type === "transfer") {
    // Four shapes: account→account (S + D), account→site "Add Fund" (S + P, no D),
    // site→account withdrawal (P + D, no S — money moved back out of a site's funds),
    // and site→site fund transfer (P + DP, no accounts — funds moved between two sites).
    if (!S && !P) return fail("Source account or site is required");
    if (S) {
      if (!D && !P) return fail("Destination account or project is required");
      if (D && D === S) return fail("Source and destination must be different");
    } else if (DP) {
      // Source is a site's funds → another site's funds (site→site).
      if (DP === P) return fail("Source and destination sites must be different");
    } else {
      // Source is a site's funds → it must go into an account.
      if (!D) return fail("Destination account or site is required");
    }
  } else if (type === "expense") {
    // The category (Head / Type of Head) is OPTIONAL — an expense may have no category at
    // all. When one IS supplied, prefer category_id (fall back to a name lookup for legacy
    // callers) and it must resolve; a bad id/name is rejected rather than silently dropped.
    if (b.category_id || b.category) {
      let cat: { id: number; name: string; parent_id: number | null } | undefined;
      if (b.category_id) {
        const rows = await query<{ id: number; name: string; parent_id: number | null }>(
          "SELECT id, name, parent_id FROM categories WHERE id = ? LIMIT 1",
          [Number(b.category_id)]
        );
        cat = rows[0];
      } else {
        const rows = await query<{ id: number; name: string; parent_id: number | null }>(
          "SELECT id, name, parent_id FROM categories WHERE name = ? LIMIT 1",
          [b.category]
        );
        cat = rows[0];
      }
      if (!cat) return fail("Unknown category");
      categoryId = cat.id;
      categoryName = cat.name;
    }
    if (!P && !S) return fail("Project (site) or account is required");
  } else if (type === "income") {
    if (!D && !P) return fail("Destination account or project is required");
  } else if (type === "partner_contribution") {
    if (!S) return fail("Partner account is required");
  } else if (type === "partner_withdrawal") {
    if (!S) return fail("Partner account is required");
  }

  // Site→site fund transfer: no account moves money, so it's posted as a PAIR of rows —
  // an OUTGOING `transfer` on the source site (project_id = P, dest_project_id = DP, no
  // accounts → counted by SITE_XFER_OUT_SQL, lowering the source site) and an INCOMING
  // `income` on the destination site (project_id = DP, dest_project_id = P, no dest account
  // → counted by RECEIVED_SQL, raising the destination site). Total money is conserved.
  if (type === "transfer" && !S && P && DP) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Source site must have enough allocated funds (lock the ledger read implicitly via txn).
      const [siteRows]: any = await conn.query(
        `SELECT (${RECEIVED_SQL} - ${SPENT_SQL} - ${SITE_OUT_SQL} - ${SITE_XFER_OUT_SQL}) AS bal
           FROM transactions t WHERE t.project_id = ?`,
        [P]
      );
      const bal = Number(siteRows[0]?.bal || 0);
      if (toPaisa(bal) < toPaisa(amount)) {
        await conn.rollback();
        return fail(`Insufficient site funds — only ${inr(bal)} available. Add funds to the site first.`);
      }

      const [names]: any = await conn.query(
        `SELECT (SELECT name FROM projects WHERE id = ?) AS src, (SELECT name FROM projects WHERE id = ?) AS dst`,
        [P, DP]
      );
      const srcName = names[0]?.src ?? `Site ${P}`;
      const dstName = names[0]?.dst ?? `Site ${DP}`;

      // OUT leg — reduces the source site's funds.
      const [outRes]: any = await conn.query(
        `INSERT INTO transactions
          (type, txn_date, project_id, dest_project_id, source_account_id, dest_account_id, amount, paid_to, note)
         VALUES ('transfer', ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        [txnDate, P, DP, amount, b.paid_to || null, b.note || null]
      );
      // IN leg — raises the destination site's funds.
      await conn.query(
        `INSERT INTO transactions
          (type, txn_date, project_id, dest_project_id, source_account_id, dest_account_id, amount, paid_to, note)
         VALUES ('income', ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        [txnDate, DP, P, amount, b.paid_to || null, b.note || null]
      );

      await logActivity(
        {
          action: "created",
          entity: "transaction",
          entityId: outRes.insertId,
          projectId: P,
          title: "Site funds transferred",
          amount,
          meta: { type: "transfer", detail: `${srcName} → ${dstName}`, note: b.note || null, site_transfer: true },
        },
        conn
      );

      await conn.commit();
      return ok({ id: outRes.insertId }, "Transaction saved", {}, 201);
    } catch (e: any) {
      await conn.rollback();
      console.error("POST /api/transactions (site→site) failed:", e);
      return fail("Something went wrong. Please try again.", 500);
    } finally {
      conn.release();
    }
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

    // Site funds must cover money drawn from them: a site-funded expense (no source account),
    // or a transfer OUT of the site's funds into an account (no source account + a dest account).
    const drawsSiteFunds = !S && !!P && (type === "expense" || (type === "transfer" && !!D));
    if (drawsSiteFunds) {
      const [siteRows]: any = await conn.query(
        `SELECT (${RECEIVED_SQL} - ${SPENT_SQL} - ${SITE_OUT_SQL}) AS bal FROM transactions t WHERE t.project_id = ?`,
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
        projectId: P,
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
