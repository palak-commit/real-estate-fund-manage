import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SPENT_TOTAL_SQL, INCOME_SQL } from "@/lib/queries";
import { ok, fail } from "@/lib/api";
import { projectCreateSchema, zErr } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const projects = await query(
    `SELECT p.*,
       ${RECEIVED_SQL} AS received,
       ${INCOME_SQL} AS income,
       ${SPENT_TOTAL_SQL} AS spent,
       ${SPENT_SQL} AS spent_site,
       MAX(t.txn_date) AS last_txn_date
     FROM projects p
     LEFT JOIN transactions t ON t.project_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  );
  return ok(
    projects.map((p: any) => ({
      ...p,
      received: Number(p.received),
      income: Number(p.income), // money earned from the site (revenue)
      spent: Number(p.spent), // total spend (site funds + direct bank)
      balance: Number(p.received) - Number(p.spent_site), // balance uses site funds only
      // Profit = income earned − ALL money spent on the site (site funds + direct).
      profit: Number(p.income) - Number(p.spent),
    })),
    "Projects fetched successfully"
  );
}

export async function POST(req: NextRequest) {
  await ready();
  const parsed = projectCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const { name, status } = parsed.data;
  const [res]: any = await pool.query("INSERT INTO projects (name, status) VALUES (?, ?)", [name, status]);
  await logActivity({ action: "created", entity: "site", entityId: res.insertId, projectId: res.insertId, title: `Site "${name}" created`, meta: { status } });
  return ok({ id: res.insertId }, "Project created", {}, 201);
}
