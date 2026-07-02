import { query } from "@/lib/db";
import { RECEIVED_SQL, SPENT_SQL, SITE_OUT_SQL, SITE_XFER_OUT_SQL, SPENT_TOTAL_SQL, SPENT_14D_SQL, INCOME_SQL } from "@/lib/queries";
import { siteStatus, profitStatus } from "@/lib/format";
import { ok } from "@/lib/api";

export async function GET() {
  // Account balances by type
  const byType = await query<{ account_type: string; total: number }>(
    "SELECT account_type, COALESCE(SUM(current_balance),0) AS total FROM accounts GROUP BY account_type"
  );
  const acc: Record<string, number> = { bank: 0, cash: 0, partner: 0 };
  for (const r of byType) acc[r.account_type] = Number(r.total);

  // Total site funds (received − site-fund spend − money transferred back out, across all projects)
  const siteAgg = await query<{ funds: number }>(
    `SELECT (${RECEIVED_SQL} - ${SPENT_SQL} - ${SITE_OUT_SQL} - ${SITE_XFER_OUT_SQL}) AS funds FROM transactions t`
  );
  const siteFunds = Number(siteAgg[0]?.funds || 0);

  // Today + yesterday + this-month expense
  const today = await query<{ t: number }>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM transactions WHERE type='expense' AND txn_date=CURDATE()"
  );
  const yesterday = await query<{ t: number }>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM transactions WHERE type='expense' AND txn_date=SUBDATE(CURDATE(),1)"
  );
  const month = await query<{ t: number }>(
    `SELECT COALESCE(SUM(amount),0) AS t FROM transactions
     WHERE type='expense' AND YEAR(txn_date)=YEAR(CURDATE()) AND MONTH(txn_date)=MONTH(CURDATE())`
  );

  const activeSites = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM projects WHERE status='active'"
  );

  // Pending RA receivables: money billed (net_receivable) but not yet received (SUM of
  // payments), across receipts that aren't fully received. Integer-paisa safe via the
  // GREATEST guard so a slight over-receipt never goes negative.
  const recv = await query<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(GREATEST(r.net_receivable - COALESCE(pp.paid,0), 0)),0) AS total,
            COUNT(*) AS count
       FROM ra_receipts r
       LEFT JOIN (SELECT receipt_id, SUM(amount) AS paid FROM ra_payments GROUP BY receipt_id) pp
              ON pp.receipt_id = r.id
      WHERE r.net_receivable > COALESCE(pp.paid,0)`
  );

  // Pending vendor payables: money owed (total_bill) but not yet paid (SUM of payments),
  // across bills that aren't fully paid. Integer-paisa safe via the GREATEST guard.
  const payable = await query<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(GREATEST(b.total_bill - COALESCE(pp.paid,0), 0)),0) AS total,
            COUNT(*) AS count
       FROM vendor_bills b
       LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) pp
              ON pp.bill_id = b.id
      WHERE b.total_bill > COALESCE(pp.paid,0)`
  );

  // Aging buckets for outstanding payables & receivables, aged from the bill date (txn_date)
  // to today: Current (≤30d), 31–60d, 61–90d, 90+d. Undated rows fall into Current (age 0).
  // Same outstanding logic as pendingPayable/pendingReceivable above.
  const AGING_BUCKETS = (outstanding: string) => `
    SELECT
      COALESCE(SUM(CASE WHEN age <= 30 THEN amt END),0) AS b0,
      COALESCE(SUM(CASE WHEN age BETWEEN 31 AND 60 THEN amt END),0) AS b30,
      COALESCE(SUM(CASE WHEN age BETWEEN 61 AND 90 THEN amt END),0) AS b60,
      COALESCE(SUM(CASE WHEN age > 90 THEN amt END),0) AS b90
    FROM (${outstanding}) x`;
  const payAging = await query<{ b0: number; b30: number; b60: number; b90: number }>(
    AGING_BUCKETS(
      `SELECT GREATEST(b.total_bill - COALESCE(pp.paid,0),0) AS amt,
              COALESCE(DATEDIFF(CURDATE(), b.txn_date),0) AS age
         FROM vendor_bills b
         LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) pp ON pp.bill_id=b.id
        WHERE b.total_bill > COALESCE(pp.paid,0)`
    )
  );
  const recvAging = await query<{ b0: number; b30: number; b60: number; b90: number }>(
    AGING_BUCKETS(
      `SELECT GREATEST(r.net_receivable - COALESCE(pp.paid,0),0) AS amt,
              COALESCE(DATEDIFF(CURDATE(), r.txn_date),0) AS age
         FROM ra_receipts r
         LEFT JOIN (SELECT receipt_id, SUM(amount) AS paid FROM ra_payments GROUP BY receipt_id) pp ON pp.receipt_id=r.id
        WHERE r.net_receivable > COALESCE(pp.paid,0)`
    )
  );
  const agingOf = (row: any) => {
    const b0 = Number(row?.b0 || 0), b30 = Number(row?.b30 || 0), b60 = Number(row?.b60 || 0), b90 = Number(row?.b90 || 0);
    return { b0, b30, b60, b90, total: b0 + b30 + b60 + b90 };
  };

  // Top outstanding payables (Vendors owed) and receivables (Sites/Clients owing)
  const topPayables = await query<{ name: string; project_name: string; amount: number; days: number }>(
    `SELECT b.paid_to AS name, 
            MAX(p.name) AS project_name,
            GREATEST(SUM(b.total_bill - COALESCE(pp.paid,0)), 0) AS amount,
            MAX(COALESCE(DATEDIFF(CURDATE(), b.txn_date), 0)) AS days
       FROM vendor_bills b
       LEFT JOIN projects p ON p.id = b.project_id
       LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) pp ON pp.bill_id = b.id
      GROUP BY b.paid_to
     HAVING amount > 0
      ORDER BY days DESC, amount DESC LIMIT 5`
  );
  
  const topReceivables = await query<{ name: string; project_name: string; amount: number; days: number }>(
    `SELECT COALESCE(r.paid_to, 'Unknown Client') AS name, 
            MAX(p.name) AS project_name,
            GREATEST(SUM(r.net_receivable - COALESCE(pp.paid,0)), 0) AS amount,
            MAX(COALESCE(DATEDIFF(CURDATE(), r.txn_date), 0)) AS days
       FROM ra_receipts r
       LEFT JOIN projects p ON p.id = r.project_id
       LEFT JOIN (SELECT receipt_id, SUM(amount) AS paid FROM ra_payments GROUP BY receipt_id) pp ON pp.receipt_id = r.id
      GROUP BY COALESCE(r.paid_to, 'Unknown Client')
     HAVING amount > 0
      ORDER BY days DESC, amount DESC LIMIT 5`
  );

  // Money that went OUT of each account type — expenses paid directly from the account PLUS
  // site-fund allocations (a transfer out of the account into a site, i.e. no dest account).
  // Account-to-account transfers (dest account set) are internal moves and don't count.
  const spentByType = await query<{ account_type: string; total: number }>(
    `SELECT a.account_type, COALESCE(SUM(t.amount),0) AS total
       FROM transactions t JOIN accounts a ON a.id = t.source_account_id
      WHERE t.type='expense' OR (t.type='transfer' AND t.dest_account_id IS NULL)
      GROUP BY a.account_type`
  );
  const spent: Record<string, number> = { bank: 0, cash: 0, partner: 0 };
  for (const r of spentByType) spent[r.account_type] = Number(r.total);

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
  const totalIncome = profitRows.reduce((s, r) => s + Number(r.income), 0); // revenue earned from sites

  // Per-site summary (with burn / runway)
  const sites = await query(
    `SELECT p.id, p.name, p.status,
       ${RECEIVED_SQL} AS received,
       ${INCOME_SQL} AS income,
       ${SPENT_TOTAL_SQL} AS spent,
       ${SPENT_SQL} AS spent_site,
       ${SITE_OUT_SQL} AS site_out,
       ${SITE_XFER_OUT_SQL} AS site_xfer_out,
       ${SPENT_14D_SQL} AS spent14
     FROM projects p LEFT JOIN transactions t ON t.project_id = p.id
     WHERE p.status <> 'completed'
     GROUP BY p.id ORDER BY (${RECEIVED_SQL} - ${SPENT_SQL} - ${SITE_OUT_SQL} - ${SITE_XFER_OUT_SQL}) DESC`
  );

  // Recent transactions
  const recent = await query(
    `SELECT t.*, sa.name AS source_name, da.name AS dest_name, p.name AS project_name,
            dp.name AS dest_project_name,
            CASE WHEN c.parent_id IS NOT NULL THEN c.name END AS category, COALESCE(pc.name, c.name) AS category_head
     FROM transactions t
     LEFT JOIN accounts sa ON sa.id = t.source_account_id
     LEFT JOIN accounts da ON da.id = t.dest_account_id
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN projects dp ON dp.id = t.dest_project_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     ORDER BY t.txn_date DESC, t.id DESC LIMIT 10`
  );

  return ok({
    bank: acc.bank,
    cash: acc.cash,
    partner: acc.partner,
    siteFunds,
    availableToAllocate: acc.bank + acc.cash,
    // Conserved total: liquid accounts + money deployed into sites. Moving cash into a
    // site shifts it from Bank/Cash to In-Sites without changing this headline.
    totalMoney: acc.bank + acc.cash + acc.partner + siteFunds,
    todayExpense: Number(today[0]?.t || 0),
    yesterdayExpense: Number(yesterday[0]?.t || 0),
    monthExpense: Number(month[0]?.t || 0),
    pendingReceivable: Number(recv[0]?.total || 0),
    pendingReceivableCount: Number(recv[0]?.count || 0),
    pendingPayable: Number(payable[0]?.total || 0),
    pendingPayableCount: Number(payable[0]?.count || 0),
    topPayables: topPayables.map((r: any) => ({ name: r.name, project_name: r.project_name, amount: Number(r.amount), days: Number(r.days) })),
    topReceivables: topReceivables.map((r: any) => ({ name: r.name, project_name: r.project_name, amount: Number(r.amount), days: Number(r.days) })),
    payablesAging: agingOf(payAging[0]),
    receivablesAging: agingOf(recvAging[0]),
    spentBank: spent.bank,
    spentCash: spent.cash,
    spentPartner: spent.partner,
    spentTotal: spent.bank + spent.cash + spent.partner,
    activeSites: Number(activeSites[0]?.c || 0),
    totalProfit,
    totalIncome,
    sites: sites.map((s: any) => {
      // Balance reflects only allocated site funds; "spent" shows total spend on the site.
      const balance = Number(s.received) - Number(s.spent_site) - Number(s.site_out || 0) - Number(s.site_xfer_out || 0);
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
