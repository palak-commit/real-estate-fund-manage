import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { categoryCreateSchema, zErr } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export async function GET() {
  // Return the two-level tree: Heads (parent_id NULL) each with their Sub-Heads,
  // annotated with the total expense spent against each (so the /heads page can show
  // "how much went to this Head / Type of Head").
  const rows = await query<{ id: number; name: string; parent_id: number | null }>(
    "SELECT id, name, parent_id FROM categories ORDER BY name"
  );
  // Spend per category_id from expenses. A category_id can be a head (head-only
  // expense) or a sub-head; a head's total = its own head-only spend + all its sub-heads'.
  const spendRows = await query<{ category_id: number; spent: number }>(
    "SELECT category_id, SUM(amount) AS spent FROM transactions WHERE type = 'expense' AND category_id IS NOT NULL GROUP BY category_id"
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
