import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    connectionLimit: 10,
    decimalNumbers: true,
  });

if (process.env.NODE_ENV !== "production") global._pool = pool;

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

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await ready();
  try {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  } catch (e: any) {
    if (SCHEMA_GONE.has(e?.code)) {
      // Schema disappeared — rebuild it and retry once.
      global._dbInit = undefined;
      await ready();
      const [rows] = await pool.query(sql, params);
      return rows as T[];
    }
    throw e;
  }
}
