// Creates the database, tables, and starter seed data.
// Run with: npm run db:setup   (safe to re-run; seeds only when empty)
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env.local loader (no extra deps)
try {
  const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const cfg = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};
const dbName = process.env.DB_NAME || "real_estate_money";

const root = await mysql.createConnection({ ...cfg, multipleStatements: true });
await root.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
await root.query(`USE \`${dbName}\``);

const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
await root.query(schema);
console.log("✓ Schema applied");

const [[{ c }]] = await root.query("SELECT COUNT(*) AS c FROM accounts");
if (c === 0) {
  await root.query(
    `INSERT INTO accounts (name, account_type, opening_balance, current_balance) VALUES
      ('HDFC Bank', 'bank', 1000000, 1000000),
      ('ICICI Bank', 'bank', 500000, 500000),
      ('Office Cash', 'cash', 50000, 50000),
      ('Site Cash', 'cash', 0, 0),
      ('Rajesh Partner', 'partner', 0, 0),
      ('Amit Partner', 'partner', 0, 0)`
  );
  await root.query(
    `INSERT INTO accounts (name, account_type, opening_balance, current_balance) VALUES
      ('Axis Bank', 'bank', 0, 0)`
  );
  await root.query(
    `INSERT INTO projects (name, status) VALUES
      ('Green City', 'active'),
      ('River View', 'active'),
      ('Farm House', 'active')`
  );
  console.log("✓ Seed data inserted");
} else {
  console.log("• Accounts already exist, skipping seed");
}

await root.end();
console.log("✓ Done. Database ready:", dbName);
