import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SPENT_TOTAL_SQL, SPENT_14D_SQL } from "@/lib/queries";
import { ok, fail } from "@/lib/api";
import { projectUpdateSchema, parseId, zErr } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return fail("Invalid project id", 400);
  const rows = await query(
    `SELECT p.*,
       ${RECEIVED_SQL} AS received,
       ${SPENT_TOTAL_SQL} AS spent,
       ${SPENT_SQL} AS spent_site,
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
    `SELECT c.name AS category, COALESCE(SUM(t.amount),0) AS total
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.project_id = ? AND t.type = 'expense'
     GROUP BY c.name ORDER BY total DESC`,
    [id]
  );

  const txns = await query(
    `SELECT t.*, sa.name AS source_name, da.name AS dest_name, c.name AS category
     FROM transactions t
     LEFT JOIN accounts sa ON sa.id = t.source_account_id
     LEFT JOIN accounts da ON da.id = t.dest_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.project_id = ?
     ORDER BY t.txn_date DESC, t.id DESC LIMIT 100`,
    [id]
  );

  return ok(
    {
      ...p,
      received: Number(p.received),
      spent: Number(p.spent), // total spend (site funds + direct bank)
      spent14: Number(p.spent14),
      balance: Number(p.received) - Number(p.spent_site), // balance uses site funds only
      byCategory: byCategory.map((c: any) => ({ ...c, total: Number(c.total) })),
      transactions: txns,
    },
    "Project fetched successfully"
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid project id", 400);
  const parsed = projectUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const { name, status } = parsed.data;
  await pool.query("UPDATE projects SET name = ?, status = ? WHERE id = ?", [name, status, id]);
  return ok(null, "Project updated");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid project id", 400);

  // Guard: a site with any transactions holds real money history (funds added, expenses).
  // Deleting it would orphan that ledger and corrupt the total-money view, so refuse and
  // tell the owner to clear the site's transactions first.
  const [dep]: any = await pool.query(
    "SELECT COUNT(*) AS c FROM transactions WHERE project_id = ?",
    [id]
  );
  const n = Number(dep[0]?.c || 0);
  if (n > 0) {
    return fail(
      `Cannot delete — this site has ${n} ${n === 1 ? "transaction" : "transactions"}. Delete or move those transactions first.`
    );
  }

  await pool.query("DELETE FROM projects WHERE id = ?", [id]);
  return ok(null, "Project deleted");
}
