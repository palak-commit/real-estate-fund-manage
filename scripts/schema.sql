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

-- Expense categories: a predefined set is seeded on first run; admins can add more.
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
