import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Predefined expense categories seeded on first run, as a two-level Head -> Sub-Head
// tree (mirrors the Excel workbook). Heads with a single line of activity still get one
// sub-head so every expense can be tagged at the (required) sub-head level.
const SEED_CATEGORY_TREE: { head: string; subs: string[] }[] = [
  { head: "Material", subs: ["HDPE Pipe", "DI Pipe", "GI Pipe", "House Connection & Fitting", "Steel", "Cement", "Kapchi", "Reti", "Inta", "Colour", "Water Tanker", "Other Material", "Parchuran Material", "Shuttering Saman", "Pump", "Cable", "Neeri"] },
  { head: "Labour Exp.", subs: ["Mistri", "Majur"] },
  { head: "Machinery Rent", subs: ["JCB Rent", "Roller Rent"] },
  { head: "Salary", subs: ["Office Staff"] },
  { head: "Sub-Contract", subs: ["Pipeline Laying", "Excavation"] },
  { head: "Fuel Exp.", subs: ["Diesel", "Petrol"] },
  { head: "Transportation Exp.", subs: ["Transportation"] },
  { head: "Site Exp.", subs: ["Site Expense"] },
  { head: "Survey Design & Report Exp.", subs: ["Survey Design & Report"] },
  { head: "Vevar RA-Bill", subs: ["Vevar RA-Bill"] },
  { head: "Travelling Exp.", subs: ["Travelling"] },
  { head: "Commission Exp.", subs: ["Commission"] },
  { head: "Godown Rent", subs: ["Godown Rent"] },
  { head: "Vehical Exp.", subs: ["Vehicle"] },
  { head: "Room Exp.", subs: ["Room"] },
  { head: "Printing & Stationary", subs: ["Printing & Stationary"] },
  { head: "Repairing & Maintenance", subs: ["Repairing & Maintenance"] },
  { head: "Stand Post Exp.", subs: ["Stand Post"] },
  { head: "Other Exp.", subs: ["Other"] },
  { head: "Deposite", subs: ["Deposite"] },
  { head: "Fixed Asset", subs: ["Fixed Asset"] },
  { head: "Legal", subs: ["Legal"] },
  { head: "Government", subs: ["Government"] },
];

declare global {
  // eslint-disable-next-line no-var
  var _pool: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var _dbInit: Promise<void> | undefined;
}

const cfg = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};
const dbName = process.env.DB_NAME || "real_estate_money";

export const pool =
  global._pool ||
  mysql.createPool({
    ...cfg,
    database: dbName,
    waitForConnections: true,
    // Serverless: many concurrent function instances each open a pool, so keep the
    // per-instance limit small to avoid exhausting the database's connection cap.
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 5),
    maxIdle: 2,
    idleTimeout: 30_000,
    enableKeepAlive: true, // keep TCP alive so idle connections aren't silently dropped
    keepAliveInitialDelay: 10_000,
    connectTimeout: 15_000,
    decimalNumbers: true,
  });

// Reuse the pool across warm invocations (in dev this also survives hot-reload).
global._pool = pool;

// Auto-create database + tables (and seed if empty) on first DB access.
// Idempotent: CREATE ... IF NOT EXISTS, so it's safe on every server start.
async function initialize(): Promise<void> {
  const admin = await mysql.createConnection({ ...cfg, multipleStatements: true });
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await admin.query(`USE \`${dbName}\``);

    // Detect a truly fresh DB BEFORE creating tables. We only seed demo data
    // the very first time the schema is created — never when a table just
    // happens to be empty (so user data is never overwritten by demo data).
    const [existing]: any = await admin.query("SHOW TABLES LIKE 'accounts'");
    const freshDatabase = existing.length === 0;

    const schema = readFileSync(join(process.cwd(), "scripts", "schema.sql"), "utf8");
    await admin.query(schema);

    const hasColumn = async (col: string) => {
      const [rows]: any = await admin.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = ? AND table_name = 'transactions' AND column_name = ?`,
        [dbName, col]
      );
      return rows.length > 0;
    };

    // Migrate transactions.category (free text) -> category_id (FK to categories).
    // Databases created before this change still have the old VARCHAR column.
    if (await hasColumn("category")) {
      if (!(await hasColumn("category_id"))) {
        await admin.query("ALTER TABLE transactions ADD COLUMN category_id INT NULL AFTER amount");
      }
      // Make sure every category name actually used exists as a row, then map name -> id.
      await admin.query(
        `INSERT IGNORE INTO categories (name)
           SELECT DISTINCT category FROM transactions
            WHERE category IS NOT NULL AND TRIM(category) <> ''`
      );
      await admin.query(
        `UPDATE transactions t JOIN categories c ON c.name = t.category
            SET t.category_id = c.id
          WHERE t.category_id IS NULL AND t.category IS NOT NULL`
      );
      // Data migrated — drop the free-text column (this also drops any index on it).
      await admin.query("ALTER TABLE transactions DROP COLUMN category");
    }

    // Ensure performance indexes on transactions. Databases created before these were
    // added won't get them via CREATE TABLE IF NOT EXISTS, and MySQL has no portable
    // "ADD INDEX IF NOT EXISTS", so check information_schema and add any that are missing.
    const wantedIndexes: Record<string, string> = {
      idx_project_type: "(project_id, type)",
      idx_date_type: "(txn_date, type)",
      idx_source: "(source_account_id)",
      idx_dest: "(dest_account_id)",
      idx_category: "(category_id)",
    };
    const [idxRows]: any = await admin.query(
      `SELECT DISTINCT index_name FROM information_schema.statistics
        WHERE table_schema = ? AND table_name = 'transactions'`,
      [dbName]
    );
    const existingIdx = new Set(idxRows.map((r: any) => r.index_name || r.INDEX_NAME));
    for (const [name, cols] of Object.entries(wantedIndexes)) {
      if (!existingIdx.has(name)) {
        await admin.query(`ALTER TABLE transactions ADD INDEX ${name} ${cols}`);
      }
    }

    // Ensure the category_id foreign key exists (named so this check is idempotent).
    const [fkRows]: any = await admin.query(
      `SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = ? AND table_name = 'transactions'
          AND constraint_name = 'fk_txn_category'`,
      [dbName]
    );
    if (!fkRows.length) {
      await admin.query(
        `ALTER TABLE transactions ADD CONSTRAINT fk_txn_category
           FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL`
      );
    }

    // Migrate categories (flat, global-unique name) -> two-level Head/Sub-Head tree.
    // Databases created before this change have a single VARCHAR(40) UNIQUE column.
    const [nameCol]: any = await admin.query(
      `SELECT character_maximum_length AS len FROM information_schema.columns
        WHERE table_schema = ? AND table_name = 'categories' AND column_name = 'name'`,
      [dbName]
    );
    if (Number(nameCol[0]?.len || 0) < 80) {
      await admin.query("ALTER TABLE categories MODIFY COLUMN name VARCHAR(80) NOT NULL");
    }
    const catHasColumn = async (col: string) => {
      const [r]: any = await admin.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = ? AND table_name = 'categories' AND column_name = ?`,
        [dbName, col]
      );
      return r.length > 0;
    };
    if (!(await catHasColumn("parent_id"))) {
      await admin.query("ALTER TABLE categories ADD COLUMN parent_id INT NULL AFTER name");
    }
    const [catIdxRows]: any = await admin.query(
      `SELECT DISTINCT index_name FROM information_schema.statistics
        WHERE table_schema = ? AND table_name = 'categories'`,
      [dbName]
    );
    const catIdx = new Set(catIdxRows.map((r: any) => r.index_name || r.INDEX_NAME));
    // The old global UNIQUE(name) (auto-named `name`) must go — names are now unique per head.
    if (catIdx.has("name")) await admin.query("ALTER TABLE categories DROP INDEX `name`");
    if (!catIdx.has("uq_cat_parent_name")) {
      await admin.query("ALTER TABLE categories ADD UNIQUE KEY uq_cat_parent_name (parent_id, name)");
    }
    if (!catIdx.has("idx_cat_parent")) {
      await admin.query("ALTER TABLE categories ADD INDEX idx_cat_parent (parent_id)");
    }
    const [catFk]: any = await admin.query(
      `SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = ? AND table_name = 'categories' AND constraint_name = 'fk_cat_parent'`,
      [dbName]
    );
    if (!catFk.length) {
      await admin.query(
        `ALTER TABLE categories ADD CONSTRAINT fk_cat_parent
           FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE`
      );
    }

    // Add the site / account / paid_to columns to ra_receipts for databases that created
    // the table before these were introduced (CREATE TABLE IF NOT EXISTS won't alter it).
    const raHasColumn = async (col: string) => {
      const [r]: any = await admin.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = ? AND table_name = 'ra_receipts' AND column_name = ?`,
        [dbName, col]
      );
      return r.length > 0;
    };
    if (!(await raHasColumn("project_id"))) {
      await admin.query("ALTER TABLE ra_receipts ADD COLUMN project_id INT NULL AFTER txn_date");
      await admin.query("ALTER TABLE ra_receipts ADD INDEX idx_ra_project (project_id)");
      await admin.query(
        `ALTER TABLE ra_receipts ADD CONSTRAINT fk_ra_project
           FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`
      );
    }
    if (!(await raHasColumn("account_id"))) {
      await admin.query("ALTER TABLE ra_receipts ADD COLUMN account_id INT NULL AFTER project_id");
      await admin.query("ALTER TABLE ra_receipts ADD INDEX idx_ra_account (account_id)");
      await admin.query(
        `ALTER TABLE ra_receipts ADD CONSTRAINT fk_ra_account
           FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL`
      );
    }
    if (!(await raHasColumn("paid_to"))) {
      await admin.query("ALTER TABLE ra_receipts ADD COLUMN paid_to VARCHAR(160) NULL AFTER account_id");
    }
    if (!(await raHasColumn("txn_id"))) {
      await admin.query("ALTER TABLE ra_receipts ADD COLUMN txn_id INT NULL");
    }
    if (!(await raHasColumn("status"))) {
      await admin.query(
        "ALTER TABLE ra_receipts ADD COLUMN status ENUM('pending','partial','complete') NOT NULL DEFAULT 'pending' AFTER note"
      );
    }
    if (!(await raHasColumn("net_receivable"))) {
      await admin.query("ALTER TABLE ra_receipts ADD COLUMN net_receivable DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER sub_let_bill");
      // Backfill legacy rows using the DEFAULT rate set (GST12/TDS1/TDSGST2/SD5/Cess1):
      // net = amount*1.03 − withheld − royalty − agency_charge.
      await admin.query(
        `UPDATE ra_receipts
            SET net_receivable = GREATEST(0, amount * 1.03 - withheld_amt - royalty - agency_charge)
          WHERE net_receivable = 0`
      );
    }

    // Add the 'ra_receipt' / 'vendor_bill' values to the activity_log entity enum on older
    // databases (CREATE TABLE IF NOT EXISTS won't alter an existing enum).
    const [entCol]: any = await admin.query(
      `SELECT COLUMN_TYPE AS t FROM information_schema.columns
        WHERE table_schema = ? AND table_name = 'activity_log' AND column_name = 'entity'`,
      [dbName]
    );
    if (entCol.length && (!String(entCol[0].t).includes("ra_receipt") || !String(entCol[0].t).includes("vendor_bill"))) {
      await admin.query(
        "ALTER TABLE activity_log MODIFY COLUMN entity ENUM('transaction','account','site','category','system','ra_receipt','vendor_bill') NOT NULL"
      );
    }

    if (freshDatabase) {
      await admin.query(
        `INSERT INTO accounts (name, account_type, opening_balance, current_balance) VALUES
          ('HDFC Bank', 'bank', 1000000, 1000000),
          ('ICICI Bank', 'bank', 500000, 500000),
          ('Axis Bank', 'bank', 0, 0),
          ('Office Cash', 'cash', 50000, 50000),
          ('Site Cash', 'cash', 0, 0),
          ('Rajesh Partner', 'partner', 0, 0),
          ('Amit Partner', 'partner', 0, 0)`
      );
      await admin.query(
        `INSERT INTO projects (name, status) VALUES
          ('Green City', 'active'), ('River View', 'active'), ('Farm House', 'active')`
      );
    }

    // Seed the predefined Head/Sub-Head tree whenever the table is empty (reference data,
    // not user transactions) — so existing databases also get the default set on next start.
    const [catRows]: any = await admin.query("SELECT COUNT(*) AS c FROM categories");
    if (Number(catRows[0]?.c || 0) === 0) {
      for (const node of SEED_CATEGORY_TREE) {
        const [hr]: any = await admin.query("INSERT INTO categories (name, parent_id) VALUES (?, NULL)", [node.head]);
        const headId = hr.insertId;
        if (node.subs.length) {
          await admin.query(
            `INSERT INTO categories (name, parent_id) VALUES ${node.subs.map(() => "(?, ?)").join(",")}`,
            node.subs.flatMap((s) => [s, headId])
          );
        }
      }
    }

    // Sub-head is required, but pre-migration data had flat categories (now heads) with
    // expenses tagged directly to the head. (1) Make sure every head that an expense
    // points to has at least one sub-head — give childless heads a same-named one.
    const [childlessHeads]: any = await admin.query(
      `SELECT h.id, h.name FROM categories h
        WHERE h.parent_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = h.id)`
    );
    for (const h of childlessHeads) {
      await admin.query("INSERT INTO categories (name, parent_id) VALUES (?, ?)", [h.name, h.id]);
    }
    // (2) Re-point ANY expense still tagged to a head down onto that head's first sub-head.
    // Covers legacy rows regardless of how the head got its sub-head. Idempotent: once no
    // expense points to a head, this matches nothing on subsequent starts.
    await admin.query(
      `UPDATE transactions t
         JOIN categories head ON head.id = t.category_id AND head.parent_id IS NULL
         JOIN categories sub ON sub.id = (SELECT MIN(c.id) FROM categories c WHERE c.parent_id = head.id)
         SET t.category_id = sub.id
       WHERE t.type = 'expense'`
    );
  } finally {
    await admin.end();
  }
}

/** Ensures the schema exists. Runs once per process; awaited by every query. */
export function ready(): Promise<void> {
  if (!global._dbInit) {
    global._dbInit = initialize().catch((e) => {
      global._dbInit = undefined; // allow retry on next request
      throw e;
    });
  }
  return global._dbInit;
}

// Errors that mean the schema vanished (DB/table dropped while running)
const SCHEMA_GONE = new Set(["ER_NO_SUCH_TABLE", "ER_BAD_DB_ERROR", "ER_BAD_FIELD_ERROR"]);

// Transient connection drops — common on serverless where the DB closes idle
// connections that are still sitting in the pool. Safe to retry on a fresh connection.
const CONNECTION_LOST = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ER_CON_COUNT_ERROR",
]);

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await ready();
  let lastErr: any;
  // Try up to 3 times: a dead pooled connection fails fast, then the pool hands
  // out a fresh one on the next attempt.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows as T[];
    } catch (e: any) {
      lastErr = e;
      if (SCHEMA_GONE.has(e?.code)) {
        // Schema disappeared — rebuild it and retry.
        global._dbInit = undefined;
        await ready();
        continue;
      }
      if (CONNECTION_LOST.has(e?.code)) continue; // retry on a fresh connection
      throw e; // genuine error — don't mask it
    }
  }
  throw lastErr;
}
