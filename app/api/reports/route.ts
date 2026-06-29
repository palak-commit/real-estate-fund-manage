import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SPENT_TOTAL_SQL, INCOME_SQL } from "@/lib/queries";
import { ok } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Date filter applied to txn_date
  const df: string[] = [];
  const a: any[] = [];
  if (from) {
    df.push("t.txn_date >= ?");
    a.push(from);
  }
  if (to) {
    df.push("t.txn_date <= ?");
    a.push(to);
  }
  const and = df.length ? " AND " + df.join(" AND ") : "";

  // Site report — received vs spent in range. Uses the SAME shared SQL as the Dashboard
  // (lib/queries) so site balances are identical on every screen.
  // `received`/`spent` are within the selected date range. `current_balance` is the
  // site's all-time balance (received − site-fund expenses across ALL dates), so the
  // Balance column always shows the real current balance regardless of the filter.
  const sites = await query(
    `SELECT p.id, p.name, p.status,
       ${RECEIVED_SQL} AS received,
       ${INCOME_SQL} AS income,
       ${SPENT_TOTAL_SQL} AS spent,
       ${SPENT_SQL} AS spent_site,
       (SELECT COALESCE(SUM(CASE WHEN t2.type IN ('transfer','income') AND t2.dest_account_id IS NULL THEN t2.amount END), 0)
             - COALESCE(SUM(CASE WHEN t2.type = 'expense' AND t2.source_account_id IS NULL THEN t2.amount END), 0)
          FROM transactions t2 WHERE t2.project_id = p.id) AS current_balance
     FROM projects p
     LEFT JOIN transactions t ON t.project_id = p.id ${df.length ? "AND " + df.join(" AND ") : ""}
     GROUP BY p.id ORDER BY p.name`,
    a
  );

  // Category report — expenses grouped by Sub-Head, with its parent Head, in range.
  // `head` lets the UI roll sub-heads up into Head totals (the Excel summary view).
  const categories = await query(
    `SELECT c.name AS category, COALESCE(h.name, c.name) AS head,
            COALESCE(SUM(t.amount),0) AS total, COUNT(*) AS count
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories h ON h.id = c.parent_id
     WHERE t.type='expense' ${and}
     GROUP BY c.id ORDER BY total DESC`,
    a
  );

  // Partner report — contributed / withdrawn in range, outstanding = current balance.
  // Contributions are now recorded as "Add Funds" (income into the partner account); the
  // legacy partner_contribution type is also counted so historical data still adds up.
  const partners = await query(
    `SELECT acc.id, acc.name, acc.current_balance AS outstanding,
       COALESCE((SELECT SUM(amount) FROM transactions t
         WHERE ((t.type='income' AND t.dest_account_id = acc.id)
             OR (t.type='partner_contribution' AND t.source_account_id = acc.id)) ${and}),0) AS contributed,
       COALESCE((SELECT SUM(amount) FROM transactions t
         WHERE t.type='partner_withdrawal' AND t.source_account_id = acc.id ${and}),0) AS withdrawn
     FROM accounts acc WHERE acc.account_type='partner' ORDER BY acc.name`,
    [...a, ...a]
  );

  return ok({
    sites: sites.map((s: any) => ({
      ...s,
      received: Number(s.received),
      income: Number(s.income), // money earned from the site in range
      spent: Number(s.spent), // total spend (site funds + direct bank) in range
      spent_site: Number(s.spent_site), // paid from the site's own allocated funds
      spent_direct: Number(s.spent) - Number(s.spent_site), // paid straight from an account
      balance: Number(s.current_balance), // current all-time balance (ignores date filter)
      // Profit = income earned − ALL money spent on the site (site funds + direct).
      profit: Number(s.income) - Number(s.spent),
    })),
    categories: categories.map((c: any) => ({ ...c, total: Number(c.total), count: Number(c.count) })),
    partners: partners.map((p: any) => ({
      ...p,
      outstanding: Number(p.outstanding),
      contributed: Number(p.contributed),
      withdrawn: Number(p.withdrawn),
    })),
  }, "Reports fetched successfully");
}
