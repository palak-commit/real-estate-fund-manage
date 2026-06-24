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

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('transfer','expense','income','partner_contribution','partner_withdrawal') NOT NULL,
  txn_date DATE NOT NULL,
  project_id INT NULL,
  source_account_id INT NULL,
  dest_account_id INT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category VARCHAR(40) NULL,
  paid_to VARCHAR(160) NULL,
  note VARCHAR(255) NULL,
  receipt_url VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project (project_id),
  INDEX idx_date (txn_date),
  INDEX idx_type (type),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (dest_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);
