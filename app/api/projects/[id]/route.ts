import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SPENT_14D_SQL } from "@/lib/queries";
import { ok, fail } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await query(
    `SELECT p.*,
       ${RECEIVED_SQL} AS received,
       ${SPENT_SQL} AS spent,
       ${SPENT_14D_SQL} AS spent14,
       MAX(t.txn_date) AS last_txn_date
     FROM projects p
     LEFT JOIN transactions t ON t.project_id = p.id
     WHERE p.id = ?
     GROUP BY p.id`,
    [id]
  );
  if (!rows.length) return fail("Not found", 404);
  const p: any = rows[0];

  const byCategory = await query(
    `SELECT category, COALESCE(SUM(amount),0) AS total
     FROM transactions WHERE project_id = ? AND type = 'expense' AND category IS NOT NULL
     GROUP BY category ORDER BY total DESC`,
    [id]
  );

  const txns = await query(
    `SELECT t.*, sa.name AS source_name, da.name AS dest_name
     FROM transactions t
     LEFT JOIN accounts sa ON sa.id = t.source_account_id
     LEFT JOIN accounts da ON da.id = t.dest_account_id
     WHERE t.project_id = ?
     ORDER BY t.txn_date DESC, t.id DESC LIMIT 100`,
    [id]
  );

  return ok(
    {
      ...p,
      received: Number(p.received),
      spent: Number(p.spent),
      spent14: Number(p.spent14),
      balance: Number(p.received) - Number(p.spent),
      byCategory: byCategory.map((c: any) => ({ ...c, total: Number(c.total) })),
      transactions: txns,
    },
    "Project fetched successfully"
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await params;
  const { name, status } = await req.json();
  await pool.query("UPDATE projects SET name = ?, status = ? WHERE id = ?", [name, status, id]);
  return ok(null, "Project updated");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await params;
  await pool.query("DELETE FROM projects WHERE id = ?", [id]);
  return ok(null, "Project deleted");
}
