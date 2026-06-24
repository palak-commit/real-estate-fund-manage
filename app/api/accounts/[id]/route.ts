import { NextRequest } from "next/server";
import { pool, query, ready } from "@/lib/db";
import { ok, fail } from "@/lib/api";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await params;
  const { name, account_type } = await req.json();
  await pool.query("UPDATE accounts SET name = ?, account_type = ? WHERE id = ?", [
    name,
    account_type,
    id,
  ]);
  return ok(null, "Account updated");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const used = await query(
    "SELECT COUNT(*) AS c FROM transactions WHERE source_account_id = ? OR dest_account_id = ?",
    [id, id]
  );
  if ((used[0] as any).c > 0) return fail("This account has transactions and cannot be deleted");
  await pool.query("DELETE FROM accounts WHERE id = ?", [id]);
  return ok(null, "Account deleted");
}
