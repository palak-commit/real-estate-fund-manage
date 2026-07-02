import { pool, ready } from "@/lib/db";
import { fail } from "@/lib/api";

// Full logical backup of the whole database, generated in pure JS (no mysqldump binary) so it
// works everywhere the app runs — including Vercel's serverless runtime. Reads every table's
// DDL (SHOW CREATE TABLE) + all rows through the app's own connection pool and streams back a
// re-importable `.sql` file. Route is admin-guarded by middleware like every other API route.
//
// GET /api/admin/backup            → downloadable .sql
// GET /api/admin/backup?meta=1     → { tables:[{name,rows}], totalRows } for the page to preview

const IDENT = (s: string) => "`" + String(s).replace(/`/g, "``") + "`";

export async function GET(req: Request) {
  await ready();
  const wantsMeta = new URL(req.url).searchParams.get("meta") === "1";

  try {
    // Every base table in the current database, in a FK-safe-ish order (alphabetical is fine
    // because we disable FK checks around the restore).
    const [tblRows]: any = await pool.query(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name"
    );
    const tables: string[] = tblRows.map((r: any) => r.name);

    // Meta mode: just row counts, for the page's "what's included" preview.
    if (wantsMeta) {
      const out: { name: string; rows: number }[] = [];
      let total = 0;
      for (const t of tables) {
        const [c]: any = await pool.query(`SELECT COUNT(*) AS n FROM ${IDENT(t)}`);
        const n = Number(c[0].n);
        out.push({ name: t, rows: n });
        total += n;
      }
      return Response.json({ success: true, data: { tables: out, totalRows: total } });
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const parts: string[] = [
      `-- Fund Manager database backup`,
      `-- Generated: ${new Date().toISOString()}`,
      `-- Tables: ${tables.length}`,
      `SET FOREIGN_KEY_CHECKS = 0;`,
      `SET NAMES utf8mb4;`,
      ``,
    ];

    for (const t of tables) {
      const [ddl]: any = await pool.query(`SHOW CREATE TABLE ${IDENT(t)}`);
      const createSql = ddl[0]["Create Table"];
      parts.push(`-- ----- Table: ${t} -----`);
      parts.push(`DROP TABLE IF EXISTS ${IDENT(t)};`);
      parts.push(`${createSql};`, ``);

      const [rows]: any = await pool.query(`SELECT * FROM ${IDENT(t)}`);
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        const colList = cols.map(IDENT).join(", ");
        // Batch inserts in chunks so a single statement never gets enormous.
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const values = chunk
            .map(
              (row: any) =>
                "(" +
                cols
                  .map((c) => {
                    const v = row[c];
                    if (v === null || v === undefined) return "NULL";
                    if (v instanceof Date) return pool.escape(v.toISOString().slice(0, 19).replace("T", " "));
                    if (Buffer.isBuffer(v)) return pool.escape(v.toString());
                    if (typeof v === "object") return pool.escape(JSON.stringify(v));
                    return pool.escape(v);
                  })
                  .join(", ") +
                ")"
            )
            .join(",\n");
          parts.push(`INSERT INTO ${IDENT(t)} (${colList}) VALUES\n${values};`);
        }
        parts.push(``);
      }
    }

    parts.push(`SET FOREIGN_KEY_CHECKS = 1;`, ``);
    const sql = parts.join("\n");

    return new Response(sql, {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="fund-manager-backup-${stamp}.sql"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("backup failed", e);
    return fail("Could not generate backup. Please try again.", 500);
  }
}
