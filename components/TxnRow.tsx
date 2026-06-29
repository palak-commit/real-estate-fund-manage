"use client";
import { Trash2 } from "lucide-react";
import { Label } from "@/components/ui";
import { inr, formatDate, CATEGORY_ICON, TYPE_LABELS, TYPE_COLOR, TYPE_ICON } from "@/lib/format";

// Income split: money earned FROM a site (tagged with a project) reads as "Income";
// plain outside money added to an account (no site) keeps the "Funds Added" label.
function typeLabel(t: any): string {
  if (t.type === "income" && t.project_id) return "Income";
  return TYPE_LABELS[t.type];
}

// Sign: money leaving the business (expense, withdrawal) is negative.
function signOf(type: string) {
  if (type === "expense" || type === "partner_withdrawal") return -1;
  if (type === "income" || type === "partner_contribution") return 1;
  return 0; // transfer is internal
}

function flow(t: any): string {
  const dest = t.dest_name || (t.project_name ? t.project_name : null);
  switch (t.type) {
    case "transfer":
      return `${t.source_name || "?"} → ${dest || "?"}`;
    case "expense": {
      // Where the money came from: a bank/cash account, or the site's own funds.
      const paidFrom = t.source_name ? t.source_name : "Site funds";
      return `Paid from ${paidFrom}${t.paid_to ? ` → ${t.paid_to}` : ""}`;
    }
    case "income": {
      // Income tied to a site lands "To" an account; plain Funds Added goes "In" an account.
      const prefix = t.project_id ? "To" : "In";
      return `${prefix} ${t.dest_name || t.project_name || "?"}${t.paid_to ? ` · from ${t.paid_to}` : ""}`;
    }
    case "partner_contribution":
      return `${t.source_name || "Partner"} → ${t.dest_name || "?"}`;
    case "partner_withdrawal":
      return `${t.source_name || "?"} → ${t.dest_name || "Partner"}`;
    default:
      return "";
  }
}

export function TxnRow({
  t,
  onDelete,
  onRowClick,
}: {
  t: any;
  onDelete?: (t: any) => void;
  onRowClick?: (t: any) => void;
}) {
  const sign = signOf(t.type);
  // Expense title shows the full "Head › Sub-category" path (collapsing to one when the
  // head and sub-head share a name, e.g. single-line heads). Icon is keyed by the Head.
  const catLabel =
    t.category_head && t.category && t.category_head !== t.category
      ? `${t.category_head} › ${t.category}`
      : t.category || t.category_head || "Expense";
  const Icon =
    t.type === "expense"
      ? CATEGORY_ICON[t.category_head] || CATEGORY_ICON[t.category] || TYPE_ICON.expense
      : TYPE_ICON[t.type];
  // Navigable rows: tied to a site (→ open that site) OR plain Funds Added into an account
  // (→ open that account's ledger). The parent's onRowClick decides where to go.
  const isFundsAdded = t.type === "income" && !t.project_id && !!t.dest_account_id;
  const navigable = !!onRowClick && (!!t.project_id || isFundsAdded);

  return (
    <div
      onClick={navigable ? () => onRowClick!(t) : undefined}
      className={`group flex items-center justify-between gap-3 px-4 py-3 ${
        navigable ? "cursor-pointer transition-colors hover:bg-muted/50" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {t.receipt_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.receipt_url} alt="receipt" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {t.type === "expense" ? catLabel : typeLabel(t)}
            </span>
            <Label color={TYPE_COLOR[t.type]}>{typeLabel(t)}</Label>
            {t.type === "expense" && t.project_name && <Label color="indigo">{t.project_name}</Label>}
            {t.type !== "expense" && t.project_name && t.dest_name && (
              <Label color="indigo">{t.project_name}</Label>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{flow(t)}</p>
          <p className="text-xs text-muted-foreground/70">
            {formatDate(t.txn_date)}
            {t.note ? ` · ${t.note}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`whitespace-nowrap text-sm font-semibold ${
            sign < 0 ? "text-danger" : sign > 0 ? "text-success" : "text-info"
          }`}
        >
          {sign < 0 ? "-" : sign > 0 ? "+" : ""}
          {inr(t.amount)}
        </span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(t);
            }}
            aria-label="Delete transaction"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
