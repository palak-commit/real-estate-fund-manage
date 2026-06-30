-- Real Estate Fund Management — client-demo MVP (3 tables)
-- Money LOCATIONS: accounts (bank/cash/partner) + projects (site funds, derived).
-- Track movement, not accounting.

CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  account_type ENUM('bank', 'cash', 'partner') NOT NULL DEFAULT 'cash',
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  status ENUM('active', 'on_hold', 'completed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense categories, TWO LEVELS: Head (parent_id IS NULL) -> Sub-Head (parent_id set).
-- Mirrors the Excel workbook's "Head / Sub-Head" structure. A predefined tree is seeded
-- on first run; admins can add more heads/sub-heads. Transactions tag the Sub-Head (leaf);
-- the Head is always derived via parent_id, so head totals roll up from their sub-heads.
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  parent_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Sub-head names are unique within their head (parent_id is non-NULL); head-name
  -- uniqueness is enforced in the API (NULLs are distinct in a UNIQUE index).
  UNIQUE KEY uq_cat_parent_name (parent_id, name),
  INDEX idx_cat_parent (parent_id),
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Append-only audit trail: every create/update/delete across the app is recorded here
-- so the owner can see a single chronological "Activity" feed of everything that happened.
CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action ENUM('created','updated','deleted','recompute') NOT NULL,
  entity ENUM('transaction','account','site','category','system') NOT NULL,
  entity_id INT NULL,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_created (created_at)
);

-- Running Account (RA) bill receipts — a standalone register that mirrors the Excel
-- "Receipt of RA" sheet. Stores only the raw INPUTS per bill (amount + manual deductions);
-- every other column (GST, total bill, TDS, SD, cess, deductions, cheque/net amounts,
-- sub-GST) is DERIVED from these plus the page's editable rate set, never stored.
CREATE TABLE IF NOT EXISTS ra_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  txn_date DATE NULL,
  project_id INT NULL,             -- which site the bill is for (origin tag)
  account_id INT NULL,             -- which account/cashbook/partner received the money
  paid_to VARCHAR(160) NULL,       -- party the receipt is from (free text, like transactions)
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  withheld_amt DECIMAL(15,2) NOT NULL DEFAULT 0,
  royalty DECIMAL(15,2) NOT NULL DEFAULT 0,
  agency_charge DECIMAL(15,2) NOT NULL DEFAULT 0,
  sub_let_bill DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Net Receivable SNAPSHOT (computed from the inputs + rate set at save time). Persisted so
  -- the server can enforce that payments never exceed the balance due, independent of the
  -- client's live rate panel.
  net_receivable DECIMAL(15,2) NOT NULL DEFAULT 0,
  note VARCHAR(255) NULL,
  -- Manual payment status set by the admin (does NOT auto-derive from payments).
  status ENUM('pending','partial','complete') NOT NULL DEFAULT 'pending',
  -- Legacy: receipts used to post their full Net Receivable as one income transaction.
  -- That behaviour is replaced by per-payment income (ra_payments); kept for old rows.
  txn_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ra_date (txn_date),
  INDEX idx_ra_project (project_id),
  INDEX idx_ra_account (account_id),
  CONSTRAINT fk_ra_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_ra_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Partial payments received against an RA receipt. Each payment with an account credits that
-- account via a real `income` transaction (linked by txn_id), so balances stay correct.
CREATE TABLE IF NOT EXISTS ra_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  txn_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  account_id INT NULL,             -- which account received this payment
  note VARCHAR(255) NULL,
  txn_id INT NULL,                 -- linked `income` transaction (no DB FK; created later)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rapay_receipt (receipt_id),
  CONSTRAINT fk_rapay_receipt FOREIGN KEY (receipt_id) REFERENCES ra_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_rapay_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('transfer','expense','income','partner_contribution','partner_withdrawal') NOT NULL,
  txn_date DATE NOT NULL,
  project_id INT NULL,
  source_account_id INT NULL,
  dest_account_id INT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category_id INT NULL,
  paid_to VARCHAR(160) NULL,
  note VARCHAR(255) NULL,
  receipt_url VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Composite indexes cover the hot aggregation paths (dashboard/reports group by
  -- project+type and filter by date+type); single-column indexes speed account filters.
  INDEX idx_project_type (project_id, type),
  INDEX idx_date_type (txn_date, type),
  INDEX idx_type (type),
  INDEX idx_source (source_account_id),
  INDEX idx_dest (dest_account_id),
  INDEX idx_category (category_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (dest_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_txn_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
