import { NextRequest } from "next/server";
import { query, pool, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { accountCreateSchema, zErr } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const accounts = await query(
    "SELECT * FROM accounts ORDER BY FIELD(account_type,'bank','cash','partner'), name"
  );
  return ok(accounts, "Accounts fetched successfully");
}

export async function POST(req: NextRequest) {
  await ready();
  const parsed = accountCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const { name, account_type, opening_balance } = parsed.data;
  const [res]: any = await pool.query(
    "INSERT INTO accounts (name, account_type, opening_balance, current_balance) VALUES (?, ?, ?, ?)",
    [name, account_type, opening_balance, opening_balance]
  );
  await logActivity({
    action: "created",
    entity: "account",
    entityId: res.insertId,
    title: `Account "${name}" added`,
    amount: opening_balance || null,
    meta: { account_type, opening_balance },
  });
  return ok({ id: res.insertId }, "Account created", {}, 201);
}
