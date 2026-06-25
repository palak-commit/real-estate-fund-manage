import { query } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SPENT_TOTAL_SQL, SPENT_14D_SQL, INCOME_SQL } from "@/lib/queries";
import { siteStatus, profitStatus } from "@/lib/format";
import { ok } from "@/lib/api";

export async function GET() {
  // Account balances by type
  const byType = await query<{ account_type: string; total: number }>(
    "SELECT account_type, COALESCE(SUM(current_balance),0) AS total FROM accounts GROUP BY account_type"
  );
  const acc: Record<string, number> = { bank: 0, cash: 0, partner: 0 };
  for (const r of byType) acc[r.account_type] = Number(r.total);

  // Total site funds (received - spent across all projects)
  const siteAgg = await query<{ funds: number }>(
    `SELECT (${RECEIVED_SQL} - ${SPENT_SQL}) AS funds FROM transactions t`
  );
  const siteFunds = Number(siteAgg[0]?.funds || 0);

  // Today + this-month expense
  const today = await query<{ t: number }>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM transactions WHERE type='expense' AND txn_date=CURDATE()"
  );
  const month = await query<{ t: number }>(
    `SELECT COALESCE(SUM(amount),0) AS t FROM transactions
     WHERE type='expense' AND YEAR(txn_date)=YEAR(CURDATE()) AND MONTH(txn_date)=MONTH(CURDATE())`
  );

  const activeSites = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM projects WHERE status='active'"
  );

  // Overall profit/loss = the literal SUM of per-site profit across ALL sites (including
  // completed). Uses the SAME shared SQL fragments as the per-site figures, so the total can
  // never diverge from the per-site profits shown on cards/detail/reports.
  // Per-site profit = site income earned − ALL money spent on the site (site funds + direct).
  const profitRows = await query<{ income: number; spent: number }>(
    `SELECT ${INCOME_SQL} AS income, ${SPENT_TOTAL_SQL} AS spent
     FROM projects p LEFT JOIN transactions t ON t.project_id = p.id
     GROUP BY p.id`
  );
  const totalProfit = profitRows.reduce((s, r) => s + (Number(r.income) - Number(r.spent)), 0);

  // Per-site summary (with burn / runway)
  const sites = await query(
    `SELECT p.id, p.name, p.status,
       ${RECEIVED_SQL} AS received,
       ${INCOME_SQL} AS income,
       ${SPENT_TOTAL_SQL} AS spent,
       ${SPENT_SQL} AS spent_site,
       ${SPENT_14D_SQL} AS spent14
     FROM projects p LEFT JOIN transactions t ON t.project_id = p.id
     WHERE p.status <> 'completed'
     GROUP BY p.id ORDER BY (${RECEIVED_SQL} - ${SPENT_SQL}) DESC`
  );

  // Recent transactions
  const recent = await query(
    `SELECT t.*, sa.name AS source_name, da.name AS dest_name, p.name AS project_name
     FROM transactions t
     LEFT JOIN accounts sa ON sa.id = t.source_account_id
     LEFT JOIN accounts da ON da.id = t.dest_account_id
     LEFT JOIN projects p ON p.id = t.project_id
     ORDER BY t.txn_date DESC, t.id DESC LIMIT 10`
  );

  return ok({
    bank: acc.bank,
    cash: acc.cash,
    partner: acc.partner,
    siteFunds,
    availableToAllocate: acc.bank + acc.cash,
    totalMoney: acc.bank + acc.cash + acc.partner,
    todayExpense: Number(today[0]?.t || 0),
    monthExpense: Number(month[0]?.t || 0),
    activeSites: Number(activeSites[0]?.c || 0),
    totalProfit,
    sites: sites.map((s: any) => {
      // Balance reflects only allocated site funds; "spent" shows total spend on the site.
      const balance = Number(s.received) - Number(s.spent_site);
      // Profit = income earned − ALL money spent on the site (site funds + direct).
      const { profit, level: profitLevel } = profitStatus(Number(s.income), Number(s.spent));
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        received: Number(s.received),
        income: Number(s.income),
        spent: Number(s.spent),
        balance,
        profit,
        profitLevel,
        ...siteStatus(balance, Number(s.spent14), Number(s.received)),
      };
    }),
    recent,
  }, "Dashboard fetched successfully");
}
