import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Predefined expense categories seeded on first run.
const DEFAULT_CATEGORIES = [
  "Labour",
  "JCB",
  "Diesel",
  "Material",
  "Legal",
  "Government",
  "Contractor",
  "Miscellaneous",
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

    // Seed the predefined categories whenever the table is empty (reference data, not
    // user transactions) — so existing databases also get the default set on next start.
    const [catRows]: any = await admin.query("SELECT COUNT(*) AS c FROM categories");
    if (Number(catRows[0]?.c || 0) === 0) {
      await admin.query(
        `INSERT IGNORE INTO categories (name) VALUES ${DEFAULT_CATEGORIES.map(() => "(?)").join(",")}`,
        DEFAULT_CATEGORIES
      );
    }
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
