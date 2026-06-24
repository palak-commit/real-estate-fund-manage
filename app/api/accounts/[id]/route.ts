import { NextRequest, NextResponse } from "next/server";
import { pool, query, ready } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await params;
  const { name, account_type } = await req.json();
  await pool.query("UPDATE accounts SET name = ?, account_type = ? WHERE id = ?", [
    name,
    account_type,
    id,
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const used = await query(
    "SELECT COUNT(*) AS c FROM transactions WHERE source_account_id = ? OR dest_account_id = ?",
    [id, id]
  );
  if ((used[0] as any).c > 0)
    return NextResponse.json(
      { error: "This account has transactions and cannot be deleted" },
      { status: 400 }
    );
  await pool.query("DELETE FROM accounts WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
