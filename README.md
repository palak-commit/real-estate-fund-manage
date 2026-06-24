# 🏠 Real Estate Fund Management — Client-Demo MVP

**Goal:** within 2 minutes a real-estate owner sees *"This system gives me complete visibility of my money across all projects."*

Not accounting · not ERP · not GST. Just **money movement + visibility**.

## Modules (admin-panel web app, left sidebar)
1. **Dashboard** — Total Money (Bank+Cash+Site Funds) hero · Bank / Cash / Site / Partner · Today + This-Month Expense · Active Sites · Site Summary (clickable) · Recent Transactions
2. **Accounts** — Bank / Cash / Partner, current balance + type totals
3. **Projects / Sites** — cards with Received / Spent / Balance + last-txn date → **detail page** (funds received, expenses, balance, last txn, expense-by-category, transaction list)
4. **Transactions** — single form, 5 types: Fund Transfer · Expense · Income · Partner Contribution · Partner Withdrawal. Fields: date, project, amount, category, source, destination, paid-to, note, **receipt photo**
5. **Reports** — Site / Category / Partner, filter Today · This Week · This Month · All · Custom range

## Money model (track movement, not accounting)
Money lives in **accounts** (bank/cash/partner) and **sites** (projects — site funds are *derived*, never stored).

Balance-effect engine ([api/transactions](app/api/transactions/route.ts)):
| Type | Effect |
|---|---|
| Fund Transfer | source account − ; destination account + (or → site funds if dest is a project) |
| Expense | site funds − (if on a site) or account − ; tagged with category |
| Income | account + (or → site funds) |
| Partner Contribution | partner account + (outstanding) **and** bank/cash account + (money in) |
| Partner Withdrawal | bank/cash account − **and** partner account − |

Derived totals:
- **Site Balance** = Σ(transfers/income into site) − Σ(site expenses)
- **Total Site Funds** = Σ all site balances
- **Total Money** = Bank + Cash + Site Funds  *(money conserved across transfers)*
- **Partner Outstanding** = Σ partner account balances = contributed − withdrawn

## Demo flow (the "aha moment" — verified ✓)
Transfer HDFC → Green City ₹2,00,000 · Labour ₹20k · JCB ₹45k · Diesel ₹12k · Partner Rajesh ₹5,00,000 →
**Green City balance ₹1,23,000**, expenses ₹77k (category breakdown), Rajesh outstanding ₹5,00,000, HDFC ₹13,00,000, Total Money ₹19,73,000 — all update instantly.

## Tech
Next.js 15 App Router + Route Handlers · MySQL (mysql2) · Tailwind · local receipt storage (`public/uploads`)
*(Swap to Supabase Postgres + Storage = V1.1; logic is DB-agnostic.)*

## Setup
```bash
# MySQL chालू hovu joiye ( here XAMPP on 3306):  sudo /opt/lampp/lampp startmysql
npm install
npm run db:setup     # database + 3 tables + seed (accounts, projects)
npm run dev          # http://localhost:3000
```

## Database (3 tables)
- `accounts` — id, name, account_type(bank|cash|partner), opening_balance, current_balance
- `projects` — id, name, status
- `transactions` — id, type, txn_date, project_id, source_account_id, dest_account_id, amount, category, paid_to, note, receipt_url, created_at

## Folder structure
```
app/
  page.tsx                  # Dashboard
  accounts/page.tsx
  projects/page.tsx  projects/[id]/page.tsx   # list + detail
  transactions/page.tsx     # history (type + project filters)
  reports/page.tsx
  not-found.tsx
  api/  accounts · projects · transactions · dashboard · reports · upload
components/  Sidebar · TransactionForm · TxnRow · ui
lib/  db.ts · format.ts · queries.ts
scripts/  schema.sql · setup-db.mjs
public/uploads/             # receipt images
```

## Development order (2–4 hr, single dev)
1. Schema + seed → 2. Accounts/Projects CRUD → 3. Transaction engine (5 types) → 4. Dashboard → 5. Project detail → 6. Reports → 7. Receipt upload → 8. Sidebar polish + deploy

## Roadmap
- **V1.1** — Excel export, receipt thumbnail grid, auth (single admin)
- **V1.2** — partner statement PDF, cash-flow report, multi-user roles, Supabase migration
# real-estate-fund-manage
