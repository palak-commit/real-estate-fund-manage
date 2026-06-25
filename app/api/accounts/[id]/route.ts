import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { accountUpdateSchema, parseId, zErr } from "@/lib/validation";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const id = parseId((await params).id);
  if (!id) return fail("Invalid account id", 400);
  const parsed = accountUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(zErr(parsed.error));
  const { name, account_type } = parsed.data;
  await pool.query("UPDATE accounts SET name = ?, account_type = ? WHERE id = ?", [
    name,
    account_type,
    id,
  ]);
  return ok(null, "Account updated");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return fail("Invalid account id", 400);
  const used = await query(
    "SELECT COUNT(*) AS c FROM transactions WHERE source_account_id = ? OR dest_account_id = ?",
    [id, id]
  );
  if ((used[0] as any).c > 0) return fail("This account has transactions and cannot be deleted");
  await pool.query("DELETE FROM accounts WHERE id = ?", [id]);
  return ok(null, "Account deleted");
}
