import { NextRequest } from "next/server";
import { z } from "zod";
import { pool, query, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SPENT_TOTAL_SQL, SPENT_14D_SQL, INCOME_SQL } from "@/lib/queries";
import { ok, fail } from "@/lib/api";
import { projectUpdateSchema, parseId, zErr } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

// Per-site RA deduction rates (percentages). All optional; missing fields fall back to
// DEFAULT_RA_RATES on the client.
const raRatesSchema = z.object({
  gst: z.coerce.number().min(0).max(100),
  tds: z.coerce.number().min(0).max(100),
  tdsGst: z.coerce.number().min(0).max(100),
  sd: z.coerce.number().min(0).max(100),
  cess: z.coerce.number().min(0).max(100),
  subletGst: z.coerce.number().min(0).max(100),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return fail("Invalid project id", 400);
  const rows = await query(
    `SELECT p.*,
       ${RECEIVED_SQL} AS received,
       ${INCOME_SQL} AS income,
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
    `SELECT c.name AS category, COALESCE(h.name, c.name) AS head,
            COALESCE(SUM(t.amount),0) AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories h ON h.id = c.parent_id
     WHERE t.project_id = ? AND t.type = 'expense'
     GROUP BY c.id ORDER BY total DESC`,
    [id]
  );

  const txns = await query(
    `SELECT t.*, sa.name AS source_name, da.name AS dest_name,
            CASE WHEN c.parent_id IS NOT NULL THEN c.name END AS category, COALESCE(pc.name, c.name) AS category_head
     FROM transactions t
     LEFT JOIN accounts sa ON sa.id = t.source_account_id
     LEFT JOIN accounts da ON da.id = t.dest_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE t.project_id = ?
     ORDER BY t.txn_date DESC, t.id DESC LIMIT 100`,
    [id]
  );

  const spentSite = Number(p.spent_site); // paid FROM site funds (reduces balance)
  const spentTotal = Number(p.spent); // site funds + direct-from-account
  return ok(
    {
      ...p,
      received: Number(p.received),
      income: Number(p.income), // money earned from the site (revenue)
      spent: spentTotal, // total spend (site funds + direct bank)
      spent_site: spentSite, // paid from the site's own allocated funds
      spent_direct: spentTotal - spentSite, // paid straight from a bank/cash account
      // Profit = income earned − ALL money spent on the site (site funds + direct).
      profit: Number(p.income) - spentTotal,
      spent14: Number(p.spent14),
      balance: Number(p.received) - spentSite, // balance uses site funds only
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
  await logActivity({ action: "updated", entity: "site", entityId: id, projectId: id, title: `Site "${name}" updated`, meta: { status } });
  return ok(null, "Project updated");
}

// Save this site's RA deduction rate overrides (used by the site's Receipt of RA tab).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid project id", 400);
  const parsed = raRatesSchema.safeParse((await req.json().catch(() => null))?.ra_rates);
  if (!parsed.success) return fail(zErr(parsed.error));
  const [res]: any = await pool.query("UPDATE projects SET ra_rates = ? WHERE id = ?", [JSON.stringify(parsed.data), id]);
  if (!res.affectedRows) return fail("Project not found", 404);
  return ok(null, "Deduction rates saved");
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

  const proj = await query<{ name: string }>("SELECT name FROM projects WHERE id = ?", [id]);
  await pool.query("DELETE FROM projects WHERE id = ?", [id]);
  await logActivity({ action: "deleted", entity: "site", entityId: id, projectId: id, title: `Site "${proj[0]?.name ?? id}" deleted` });
  return ok(null, "Project deleted");
}
