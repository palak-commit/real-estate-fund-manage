import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { ok } from "@/lib/api";

// Chronological activity feed (most recent first), paginated. Read-only — rows are
// written by logActivity() at each mutation point across the API.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") || 30)), 100);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const args: any[] = [];
  if (searchParams.get("entity")) {
    where.push("entity = ?");
    args.push(searchParams.get("entity"));
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM activity_log ${whereSql}`,
    args
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / limit);

  const rows = await query(
    `SELECT id, action, entity, entity_id, title, amount, meta, created_at
       FROM activity_log ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  );

  return ok(rows, rows.length ? "Activity fetched" : "No activity yet", {
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
