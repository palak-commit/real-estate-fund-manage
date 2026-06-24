// Shared SQL fragments for derived "site fund" math.
// received = money INTO a project (transfer/income with no dest account)
// spent    = expenses on the project
export const RECEIVED_SQL = `
  COALESCE(SUM(CASE WHEN t.type IN ('transfer','income') AND t.dest_account_id IS NULL
    THEN t.amount END), 0)`;

// Only expenses paid FROM site funds (no source account) reduce a site's balance.
// Expenses paid directly from a bank/cash account are tagged to the site for reporting
// but leave the bank account, not the site's allocated funds.
export const SPENT_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.source_account_id IS NULL
    THEN t.amount END), 0)`;

// Site-fund expenses in the last 14 days — used to estimate burn rate / runway.
export const SPENT_14D_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.source_account_id IS NULL
    AND t.txn_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN t.amount END), 0)`;
