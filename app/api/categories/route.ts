import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";

export async function GET() {
  const rows = await query("SELECT id, name FROM categories ORDER BY name");
  return ok(rows, "Categories fetched successfully");
}

export async function POST(req: NextRequest) {
  await ready();
  const { name } = await req.json().catch(() => ({}));
  const clean = (name || "").trim();
  if (!clean) return fail("Category name is required");
  if (clean.length > 40) return fail("Category name is too long (max 40 characters)");

  // Case-insensitive duplicate check.
  const existing = await query<{ id: number; name: string }>(
    "SELECT id, name FROM categories WHERE LOWER(name) = LOWER(?)",
    [clean]
  );
  if (existing.length) return fail("That category already exists");

  const [res]: any = await pool.query("INSERT INTO categories (name) VALUES (?)", [clean]);
  return ok({ id: res.insertId, name: clean }, "Category added", {}, 201);
}
