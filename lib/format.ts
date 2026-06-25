import {
  HardHat,
  Truck,
  Fuel,
  Package,
  Scale,
  Landmark,
  Wrench,
  Boxes,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Handshake,
  HandCoins,
  type LucideIcon,
} from "lucide-react";

// Indian-format currency: ₹2,00,000
export function inr(n: number | string): string {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  return sign + "₹" + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
}

// Keep only digits + a single dot, max 2 decimal places (valid rupee amount).
export function sanitizeAmount(v: string): string {
  v = v.replace(/[^0-9.]/g, "");
  const dot = v.indexOf(".");
  if (dot === -1) return v;
  return v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 2);
}

export type SiteLevel = "ok" | "low" | "critical" | "none";

// Burn rate (avg daily over last 14d) → runway days → health level.
export function siteStatus(balance: number, spent14: number, received?: number) {
  const burn = spent14 / 14;
  const runway = burn > 0 ? Math.floor(balance / burn) : null;
  let level: SiteLevel = "ok";
  if (balance <= 0) {
    // Never funded → "No funds"; funded but now empty → "Out of funds". Never "Healthy".
    level = !received ? "none" : "critical";
  } else if (burn > 0 && runway !== null && runway <= 7) {
    level = "low";
  }
  return { burn, runway, level };
}

export const LEVEL_LABEL: Record<SiteLevel, string> = {
  ok: "Healthy",
  low: "Running low",
  critical: "Out of funds",
  none: "No funds",
};

// Expense categories (site-wise + category-wise visibility)
export const CATEGORIES = [
  "Labour",
  "JCB",
  "Diesel",
  "Material",
  "Legal",
  "Government",
  "Contractor",
  "Miscellaneous",
] as const;

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Labour: HardHat,
  JCB: Truck,
  Diesel: Fuel,
  Material: Boxes,
  Legal: Scale,
  Government: Landmark,
  Contractor: Wrench,
  Miscellaneous: Package,
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Bank",
  cash: "Cash",
  partner: "Partner",
};

export const TYPE_LABELS: Record<string, string> = {
  transfer: "Transfer",
  expense: "Expense",
  income: "Funds Added",
  partner_contribution: "Partner Contribution",
  partner_withdrawal: "Partner Payout",
};

export const TYPE_COLOR: Record<string, string> = {
  transfer: "blue",
  expense: "red",
  income: "green",
  partner_contribution: "amber",
  partner_withdrawal: "amber",
};

export const TYPE_ICON: Record<string, LucideIcon> = {
  transfer: ArrowLeftRight,
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  partner_contribution: HandCoins,
  partner_withdrawal: Handshake,
};
