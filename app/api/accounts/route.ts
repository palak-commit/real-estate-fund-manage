import { NextRequest, NextResponse } from "next/server";
import { query, pool, ready } from "@/lib/db";

const TYPES = ["bank", "cash", "partner"];

export async function GET() {
  const accounts = await query(
    "SELECT * FROM accounts ORDER BY FIELD(account_type,'bank','cash','partner'), name"
  );
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  await ready();
  const { name, account_type, opening_balance } = await req.json();
  if (!name || !TYPES.includes(account_type))
    return NextResponse.json({ error: "Name and a valid type are required" }, { status: 400 });
  const opening = Number(opening_balance) || 0;
  const [res]: any = await pool.query(
    "INSERT INTO accounts (name, account_type, opening_balance, current_balance) VALUES (?, ?, ?, ?)",
    [name, account_type, opening, opening]
  );
  return NextResponse.json({ id: res.insertId }, { status: 201 });
}
