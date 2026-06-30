import { z } from "zod";

// Shared request-validation schemas + helpers. Every route validates its body with one
// of these and parses URL ids with `parseId`, so malformed input fails fast with a 400.

const name = z.string().trim().min(1, "Name is required").max(120, "Name is too long");

export const accountCreateSchema = z.object({
  name,
  account_type: z.enum(["bank", "cash", "partner"]),
  opening_balance: z.coerce.number().min(0, "Opening balance can't be negative").default(0),
});

export const accountUpdateSchema = z.object({
  name,
  account_type: z.enum(["bank", "cash", "partner"]),
});

export const projectCreateSchema = z.object({
  name,
  status: z.enum(["active", "on_hold", "completed"]).default("active"),
});

export const projectUpdateSchema = z.object({
  name,
  status: z.enum(["active", "on_hold", "completed"]),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(80, "Category name is too long (max 80 characters)"),
  // Omitted/null = a top-level Head; a positive id = a Sub-Head under that head.
  parent_id: z.coerce.number().int().positive().nullish(),
});

// Shape/type guard for transactions. Relational rules (which account/site is required
// per type, funds availability) stay in the route since they need DB lookups.
export const txnCreateSchema = z.object({
  type: z.enum(["transfer", "expense", "income", "partner_contribution", "partner_withdrawal"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

// A Running Account (RA) bill receipt. Stores only raw inputs — every derived figure
// (GST, deductions, cheque/net amounts) is computed from these in `lib/ra.ts`.
export const raReceiptSchema = z.object({
  // Optional: the Excel sheet allows undated rows.
  txn_date: z.string().trim().min(1).max(10).nullish(),
  // Optional tags: which site, which account received it, and the party it's from.
  project_id: z.coerce.number().int().positive().nullish(),
  account_id: z.coerce.number().int().positive().nullish(),
  paid_to: z.string().trim().max(160, "Paid To is too long").nullish(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  // Net Receivable, computed client-side from the page's rate set. When an account is
  // chosen this is the amount deposited into it (as an `income` transaction).
  net_receivable: z.coerce.number().min(0).nullish(),
  withheld_amt: z.coerce.number().min(0, "Withheld amount can't be negative").default(0),
  royalty: z.coerce.number().min(0, "Royalty can't be negative").default(0),
  agency_charge: z.coerce.number().min(0, "Agency charge can't be negative").default(0),
  sub_let_bill: z.coerce.number().min(0, "Sub let bill can't be negative").default(0),
  note: z.string().trim().max(255, "Note is too long").nullish(),
  status: z.enum(["pending", "partial", "complete"]).default("pending"),
});

// A partial payment received against an RA receipt. With an account it credits that account
// (posted as an `income` transaction); without one it's just a record.
export const raPaymentSchema = z.object({
  txn_date: z.string().trim().min(1, "Date is required").max(10),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  account_id: z.coerce.number().int().positive().nullish(),
  note: z.string().trim().max(255, "Note is too long").nullish(),
});

/** First human-readable error from a failed safeParse. */
export function zErr(error: z.ZodError): string {
  const i = error.issues[0];
  if (!i) return "Invalid input";
  const path = i.path.join(".");
  return path ? `${path}: ${i.message}` : i.message;
}

/** Parse a positive-integer URL id, or null if it isn't one. */
export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
