import { pool } from "@/lib/db";

// A minimal "runner" — either the shared pool or an open transaction connection, so an
// activity record can be written inside the same DB transaction as the action it logs.
type Runner = { query: (sql: string, params?: any[]) => Promise<any> };

export type ActivityAction = "created" | "updated" | "deleted" | "recompute";
export type ActivityEntity = "transaction" | "account" | "site" | "category" | "system" | "ra_receipt" | "vendor_bill";

export type ActivityEntry = {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: number | null;
  projectId?: number | null; // the site this event belongs to (for the per-site feed)
  title: string;
  amount?: number | null;
  meta?: Record<string, unknown> | null;
};

/**
 * Append one row to the activity feed. Pass an open transaction connection as `conn` to
 * make the log atomic with the action; otherwise it writes on the pool. Logging never
 * throws — a failed audit write must not break the user's actual operation.
 */
export async function logActivity(entry: ActivityEntry, conn?: Runner): Promise<void> {
  const runner: Runner = conn ?? pool;
  try {
    await runner.query(
      `INSERT INTO activity_log (action, entity, entity_id, project_id, title, amount, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.action,
        entry.entity,
        entry.entityId ?? null,
        entry.projectId ?? null,
        entry.title,
        entry.amount ?? null,
        entry.meta ? JSON.stringify(entry.meta) : null,
      ]
    );
  } catch (e) {
    console.error("logActivity failed:", e);
  }
}

// Human-readable label for a transaction type in activity titles. Mirrors the UI labels
// but is kept local so the server never imports client formatting.
const TXN_VERB: Record<string, string> = {
  transfer: "Transfer",
  expense: "Expense",
  income: "Income",
  partner_contribution: "Partner contribution",
  partner_withdrawal: "Partner payout",
};

/** A short title like `Site fund added` / `Expense recorded` for a transaction. */
export function describeTxn(type: string, opts: { hasProject?: boolean; hasDest?: boolean } = {}): string {
  // transfer + dest + project = money moved back OUT of a site's funds; dest only = a plain
  // account transfer; project only (no dest) = "Add Site Fund".
  if (type === "transfer") return opts.hasDest ? (opts.hasProject ? "Site fund withdrawn" : "Transfer") : "Site fund added";
  if (type === "income") return opts.hasProject ? "Income" : "Funds added";
  return TXN_VERB[type] ?? "Transaction";
}

/** A human "flow" line for a transaction, e.g. `HDFC Bank → Green City` or
 *  `Paid from Site funds → Cement Co · Green City`. Mirrors the ledger row subtitle. */
export function txnDetail(t: {
  type: string;
  source_name?: string | null;
  dest_name?: string | null;
  project_name?: string | null;
  category?: string | null;
  paid_to?: string | null;
}): string {
  switch (t.type) {
    case "transfer":
      // Source is a site when there's no source account (a site-fund withdrawal).
      return `${t.source_name || t.project_name || "?"} → ${t.dest_name || t.project_name || "?"}`;
    case "expense": {
      const parts = [`Paid from ${t.source_name || "Site funds"}`];
      if (t.paid_to) parts.push(`→ ${t.paid_to}`);
      if (t.project_name) parts.push(`· ${t.project_name}`);
      if (t.category) parts.push(`· ${t.category}`);
      return parts.join(" ");
    }
    case "income":
      return t.project_name ? `${t.project_name} → ${t.dest_name || "?"}` : `→ ${t.dest_name || "?"}`;
    case "partner_withdrawal":
      return `${t.source_name || "Partner"} withdrew`;
    default:
      return "";
  }
}
