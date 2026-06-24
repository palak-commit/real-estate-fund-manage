import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL } from "@/lib/queries";
import { ok, fail } from "@/lib/api";

const STATUSES = ["active", "on_hold", "completed"];

export async function GET() {
  const projects = await query(
    `SELECT p.*,
       ${RECEIVED_SQL} AS received,
       ${SPENT_SQL} AS spent,
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
      spent: Number(p.spent),
      balance: Number(p.received) - Number(p.spent),
    })),
    "Projects fetched successfully"
  );
}

export async function POST(req: NextRequest) {
  await ready();
  const { name, status } = await req.json();
  if (!name) return fail("Name is required");
  const [res]: any = await pool.query("INSERT INTO projects (name, status) VALUES (?, ?)", [
    name,
    STATUSES.includes(status) ? status : "active",
  ]);
  return ok({ id: res.insertId }, "Project created", {}, 201);
}
