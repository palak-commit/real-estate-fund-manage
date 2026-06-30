import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { parseId } from "@/lib/validation";

// Account ledger (Bank book / Cashbook / Rojmel): every transaction touching one account,
// with In (debit) / Out (credit) columns and a running balance — mirrors the Excel sheets.
// Running balances are DERIVED here (opening_balance + cumulative movement), never stored.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = parseId(searchParams.get("account_id") || "");
  const accountType = searchParams.get("account_type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // No specific account → aggregate every payment (expense) out of all accounts of this
  // type (all bank accounts, or all cash accounts). Running balance is meaningless across
  // multiple accounts, so it's omitted; the Bank/Cashbook view doesn't use it.
  if (!accountId) {
    if (accountType !== "bank" && accountType !== "cash" && accountType !== "partner") {
      return fail("account_id or account_type is required", 400);
    }
    const params: any[] = [accountType];
    let dateSql = "";
    if (from) { dateSql += " AND t.txn_date >= ?"; params.push(from); }
    if (to) { dateSql += " AND t.txn_date <= ?"; params.push(to); }
    const allRows = await query<any>(
      `SELECT t.id, DATE_FORMAT(t.txn_date, '%Y-%m-%d') AS txn_date, t.type, t.note, t.paid_to,
         sa.name AS source_name, da.name AS dest_name, t.project_id, p.name AS project_name,
         CASE WHEN c.parent_id IS NOT NULL THEN c.name END AS category, COALESCE(pc.name, c.name) AS category_head,
         0 AS debit, t.amount AS credit
       FROM transactions t
       JOIN accounts sa ON sa.id = t.source_account_id AND sa.account_type = ?
       LEFT JOIN accounts da ON da.id = t.dest_account_id
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN categories pc ON pc.id = c.parent_id
       WHERE t.type = 'expense' OR (t.type = 'transfer' AND t.dest_account_id IS NULL)${dateSql}
       ORDER BY t.txn_date ASC, t.id ASC`,
      params
    );
    const totalOut = allRows.reduce((s, r) => s + Number(r.credit), 0);
    return ok(
      { account: null, rows: allRows, summary: { opening: 0, totalIn: 0, totalOut, closing: 0 } },
      allRows.length ? "Account book fetched" : "No entries in range"
    );
  }

  const accRows = await query<{
    id: number;
    name: string;
    account_type: string;
    opening_balance: number;
    current_balance: number;
  }>("SELECT id, name, account_type, opening_balance, current_balance FROM accounts WHERE id = ?", [accountId]);
  if (!accRows.length) return fail("Account not found", 404);
  const account = accRows[0];

  // One signed pair per row: `debit` = money INTO this account, `credit` = money OUT.
  // The CASE logic matches lib/ledger.ts accountEffects() exactly.
  const rows = await query<any>(
    `SELECT t.id, DATE_FORMAT(t.txn_date, '%Y-%m-%d') AS txn_date, t.type, t.note, t.paid_to,
       sa.name AS source_name, da.name AS dest_name, t.project_id, p.name AS project_name,
       CASE WHEN c.parent_id IS NOT NULL THEN c.name END AS category, COALESCE(pc.name, c.name) AS category_head,
       CASE
         WHEN t.dest_account_id = ? AND t.type IN ('transfer','income') THEN t.amount
         WHEN t.source_account_id = ? AND t.type = 'partner_contribution' THEN t.amount
         ELSE 0 END AS debit,
       CASE
         WHEN t.source_account_id = ? AND t.type IN ('transfer','expense','partner_withdrawal') THEN t.amount
         ELSE 0 END AS credit
     FROM transactions t
     LEFT JOIN accounts sa ON sa.id = t.source_account_id
     LEFT JOIN accounts da ON da.id = t.dest_account_id
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE t.source_account_id = ? OR t.dest_account_id = ?
     ORDER BY t.txn_date ASC, t.id ASC`,
    [accountId, accountId, accountId, accountId, accountId]
  );

  // Walk the full history to keep the running balance correct, then keep only the rows in
  // the selected date window (their balance still reflects everything before them).
  // Rows are ordered by date asc, so: pre-range rows fold into `opening`, in-range rows are
  // emitted with their running balance, and we stop at the first row past `to`.
  let running = Number(account.opening_balance);
  let opening = running; // balance just before the first in-range row
  let totalIn = 0;
  let totalOut = 0;
  const out: any[] = [];
  for (const r of rows) {
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    if (from && r.txn_date < from) {
      running += debit - credit;
      opening = running; // keep folding history into the opening balance
      continue;
    }
    if (to && r.txn_date > to) break; // ordered asc → everything after this is out of range
    running += debit - credit;
    totalIn += debit;
    totalOut += credit;
    out.push({ ...r, debit, credit, balance: running });
  }

  return ok(
    {
      account,
      rows: out,
      summary: { opening, totalIn, totalOut, closing: running },
    },
    out.length ? "Account book fetched" : "No entries in range"
  );
}
