import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { categoryCreateSchema, parseId, zErr } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  // Return the two-level tree: Heads (parent_id NULL) each with their Sub-Heads,
  // annotated with the total expense spent against each (so the /heads page can show
  // "how much went to this Head / Type of Head"). The spend can be scoped by ?project_id=
  // (a site), ?account_id= (expenses paid from that account) and ?from=/?to= (date range) —
  // used by the site-detail Heads tab filters; with none, it's all-time across everything.
  const params = new URL(req.url).searchParams;
  const projectId = parseId(params.get("project_id") || "");
  const accountId = parseId(params.get("account_id") || "");
  const from = params.get("from");
  const to = params.get("to");
  const rows = await query<{ id: number; name: string; parent_id: number | null }>(
    "SELECT id, name, parent_id FROM categories ORDER BY name"
  );
  // Spend per category_id from expenses. A category_id can be a head (head-only
  // expense) or a sub-head; a head's total = its own head-only spend + all its sub-heads'.
  const where: string[] = ["type = 'expense'", "category_id IS NOT NULL"];
  const spendParams: (number | string)[] = [];
  if (projectId) { where.push("project_id = ?"); spendParams.push(projectId); }
  if (accountId) { where.push("source_account_id = ?"); spendParams.push(accountId); }
  if (from) { where.push("txn_date >= ?"); spendParams.push(from); }
  if (to) { where.push("txn_date <= ?"); spendParams.push(to); }
  const spendRows = await query<{ category_id: number; spent: number }>(
    `SELECT category_id, SUM(amount) AS spent FROM transactions
      WHERE ${where.join(" AND ")}
      GROUP BY category_id`,
    spendParams
  );
  const spentById = new Map<number, number>();
  spendRows.forEach((r) => spentById.set(r.category_id, Number(r.spent)));

  const heads = rows
    .filter((r) => r.parent_id == null)
    .map((h) => {
      const subheads = rows
        .filter((s) => s.parent_id === h.id)
        .map((s) => ({ id: s.id, name: s.name, spent: spentById.get(s.id) ?? 0 }));
      const spent = (spentById.get(h.id) ?? 0) + subheads.reduce((sum, s) => sum + s.spent, 0);
      return { id: h.id, name: h.name, spent, subheads };
    });
  return ok(heads, "Categories fetched successfully");
}

export async function POST(req: NextRequest) {
  await ready();
  const parsed = categoryCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const clean = parsed.data.name;
  const parentId = parsed.data.parent_id ?? null;

  // A sub-head must hang off a real head (not another sub-head).
  if (parentId != null) {
    const head = await query<{ parent_id: number | null }>(
      "SELECT parent_id FROM categories WHERE id = ? LIMIT 1",
      [parentId]
    );
    if (!head.length) return fail("Parent category not found");
    if (head[0].parent_id != null) return fail("A sub-category can't be nested under another sub-category");
  }

  // Case-insensitive duplicate check, scoped to the same level (same parent).
  const existing = await query<{ id: number }>(
    parentId == null
      ? "SELECT id FROM categories WHERE parent_id IS NULL AND LOWER(name) = LOWER(?)"
      : "SELECT id FROM categories WHERE parent_id = ? AND LOWER(name) = LOWER(?)",
    parentId == null ? [clean] : [parentId, clean]
  );
  if (existing.length) return fail(parentId == null ? "That head already exists" : "That sub-category already exists");

  const [res]: any = await pool.query("INSERT INTO categories (name, parent_id) VALUES (?, ?)", [clean, parentId]);
  await logActivity({
    action: "created",
    entity: "category",
    entityId: res.insertId,
    title: `${parentId == null ? "Head" : "Sub-category"} "${clean}" added`,
    meta: parentId == null ? null : { parent_id: parentId },
  });
  return ok({ id: res.insertId, name: clean, parent_id: parentId }, "Category added", {}, 201);
}
