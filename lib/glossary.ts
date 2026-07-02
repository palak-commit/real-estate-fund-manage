// Plain-language definitions for the app's domain terms. New users don't know
// "RA", "Rojmel", "Site Fund" etc. — every inline HelpTip pulls its text from here
// so the wording stays consistent everywhere the term appears.
export const GLOSSARY = {
  ra: "RA = Running Account bill. A stage-wise bill you raise (e.g. to a client or main contractor) for work done so far. Its register tracks the amount, deductions (TDS, retention, cess…) and what you finally receive.",
  rojmel: "Rojmel = a day-by-day cash book. For each day it shows the opening balance, money received, each expense, and the closing balance — like the classic handwritten daily register.",
  receivedIn:
    "Received In = where the money lands. Pick a Bank / Cash / Partner account, or “Site Fund” to add it straight to that site's own working funds.",
  siteFund:
    "Site Fund = money set aside for one site (its own wallet). You move money from an account into a site, then spend from that site's fund. Site balances go up and down with these, not your bank balance.",
  direct:
    "Direct = an expense paid straight from a Bank / Cash / Partner account (not from the site's own fund). It's still tagged to the site for reporting, but it lowers the account balance, not the site's fund.",
  head: "Expense Head = a spending category, like Material, Labour or Transport. Each Head can have Types of Head (sub-categories) under it, e.g. Material → Cement, Steel.",
  netReceivable:
    "Net Receivable = what you actually expect to collect on an RA bill after all deductions (TDS, retention, cess, agency charge…) are taken off the total bill.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
