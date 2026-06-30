import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { categoryUpdateSchema, parseId, zErr } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

type Cat = { id: number; name: string; parent_id: number | null };

async function findCategory(id: number): Promise<Cat | null> {
  const rows = await query<Cat>("SELECT id, name, parent_id FROM categories WHERE id = ? LIMIT 1", [id]);
  return rows[0] ?? null;
}

// Rename a head or sub-head. Its level (parent) never changes.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid category id", 400);
  const parsed = categoryUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const clean = parsed.data.name;

  const cat = await findCategory(id);
  if (!cat) return fail("Category not found", 404);

  // Duplicate check at the same level (same parent), excluding itself.
  const dup = await query<{ id: number }>(
    cat.parent_id == null
      ? "SELECT id FROM categories WHERE parent_id IS NULL AND LOWER(name) = LOWER(?) AND id <> ?"
      : "SELECT id FROM categories WHERE parent_id = ? AND LOWER(name) = LOWER(?) AND id <> ?",
    cat.parent_id == null ? [clean, id] : [cat.parent_id, clean, id]
  );
  if (dup.length) return fail(cat.parent_id == null ? "That head already exists" : "That sub-category already exists");

  await pool.query("UPDATE categories SET name = ? WHERE id = ?", [clean, id]);
  await logActivity({
    action: "updated",
    entity: "category",
    entityId: id,
    title: `${cat.parent_id == null ? "Head" : "Sub-category"} renamed to "${clean}"`,
  });
  return ok({ id, name: clean }, "Category renamed");
}

// Delete a head (cascades its sub-heads) or a sub-head. Refused while any transaction still
// uses it (or one of its sub-heads) — deleting would strip those transactions' category tag.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid category id", 400);

  const cat = await findCategory(id);
  if (!cat) return fail("Category not found", 404);

  // The ids whose use would block deletion: this category + (for a head) its sub-heads.
  let ids = [id];
  if (cat.parent_id == null) {
    const subs = await query<{ id: number }>("SELECT id FROM categories WHERE parent_id = ?", [id]);
    ids = ids.concat(subs.map((s) => s.id));
  }
  const placeholders = ids.map(() => "?").join(",");
  const used = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions WHERE category_id IN (${placeholders})`,
    ids
  );
  if (Number(used[0]?.n) > 0) {
    return fail(
      `Can't delete — ${used[0].n} transaction(s) still use this ${cat.parent_id == null ? "head" : "sub-category"}.`
    );
  }

  await pool.query("DELETE FROM categories WHERE id = ?", [id]); // sub-heads cascade
  await logActivity({
    action: "deleted",
    entity: "category",
    entityId: id,
    title: `${cat.parent_id == null ? "Head" : "Sub-category"} "${cat.name}" deleted`,
  });
  return ok(null, "Category deleted");
}
