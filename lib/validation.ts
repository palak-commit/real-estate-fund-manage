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
  name: z.string().trim().min(1, "Category name is required").max(40, "Category name is too long (max 40 characters)"),
});

// Shape/type guard for transactions. Relational rules (which account/site is required
// per type, funds availability) stay in the route since they need DB lookups.
export const txnCreateSchema = z.object({
  type: z.enum(["transfer", "expense", "income", "partner_contribution", "partner_withdrawal"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
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
