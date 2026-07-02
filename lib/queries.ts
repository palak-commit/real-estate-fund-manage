// Shared SQL fragments for derived "site fund" math.
// received = money INTO a project:
//   - a `transfer` with a source account and no dest account ("Add Site Fund")
//   - an `income` with no dest account (RA money received into site funds, or the RECEIVING
//     side of a site→site transfer)
// A site→site transfer's OUTGOING leg is a `transfer` with NO source account (see
// SITE_XFER_OUT_SQL); requiring a source account here keeps it out of RECEIVED so it only
// reduces the source site (never counts as money in).
export const RECEIVED_SQL = `
  COALESCE(SUM(CASE WHEN t.dest_account_id IS NULL
    AND ((t.type = 'transfer' AND t.source_account_id IS NOT NULL) OR t.type = 'income')
    THEN t.amount END), 0)`;

// Money EARNED from a site (revenue) — ANY `income` tagged to the site, whether it landed
// in a real account (a plot sale, rent, RA received into Bank/Cash) OR straight into the
// site's own funds (the RA "Received In: Site Fund" case). Both are earned income, so both
// count toward revenue/profit. The ONLY income excluded is the incoming leg of a site→site
// fund transfer (it carries a dest_project_id — internal movement, not earned revenue).
// Profit = this income − total spent on the site.
export const INCOME_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'income' AND t.dest_project_id IS NULL
    THEN t.amount END), 0)`;

// Only expenses paid FROM site funds (no source account) reduce a site's BALANCE.
// Expenses paid directly from a bank/cash account are tagged to the site for reporting
// but leave the bank account, not the site's allocated funds.
export const SPENT_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.source_account_id IS NULL
    THEN t.amount END), 0)`;

// Money moved OUT of a site's funds back into an account — a `transfer` tagged to the site
// (project_id set) with a dest account and NO source account. The inverse of "Add Site Fund":
// it credits the account (accountEffects) and reduces the site's BALANCE. So a site's balance
// is RECEIVED − SPENT − SITE_OUT everywhere. (Account-to-account transfers have a source
// account and no project; "Add Site Fund" has no dest account — both are excluded.)
export const SITE_OUT_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.source_account_id IS NULL
    AND t.dest_account_id IS NOT NULL AND t.project_id IS NOT NULL THEN t.amount END), 0)`;

// Money moved OUT of a site's funds into ANOTHER site — the outgoing leg of a site→site
// fund transfer: a `transfer` tagged to the source site (project_id set) with NO source
// account and NO dest account (the paired incoming leg is an `income` credited to the dest
// site, counted by RECEIVED_SQL). Like SITE_OUT_SQL it reduces the source site's BALANCE,
// so a site's balance is RECEIVED − SPENT − SITE_OUT − SITE_XFER_OUT everywhere. Money is
// conserved: what leaves one site (here) arrives at the other (RECEIVED).
export const SITE_XFER_OUT_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.source_account_id IS NULL
    AND t.dest_account_id IS NULL AND t.project_id IS NOT NULL THEN t.amount END), 0)`;

// TOTAL spent on a site (site funds + direct-from-bank) — the "Spent" figure shown on
// site cards/detail/reports. This does NOT affect balance (see SPENT_SQL).
export const SPENT_TOTAL_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0)`;

// Site-fund expenses in the last 14 days — used to estimate burn rate / runway.
export const SPENT_14D_SQL = `
  COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.source_account_id IS NULL
    AND t.txn_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN t.amount END), 0)`;
