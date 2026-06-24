"use client";
import { Label } from "@/components/ui";
import { inr, formatDate, CATEGORY_ICON, TYPE_LABELS, TYPE_COLOR, TYPE_ICON } from "@/lib/format";

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
    case "income":
      return `${t.paid_to ? `${t.paid_to} → ` : ""}${dest || "?"}`;
    case "partner_contribution":
      return `${t.source_name || "Partner"} → ${t.dest_name || "?"}`;
    case "partner_withdrawal":
      return `${t.source_name || "?"} → ${t.dest_name || "Partner"}`;
    default:
      return "";
  }
}

export function TxnRow({ t }: { t: any }) {
  const sign = signOf(t.type);
  const Icon = t.type === "expense" ? CATEGORY_ICON[t.category] || TYPE_ICON.expense : TYPE_ICON[t.type];

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
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
              {t.type === "expense" ? t.category || "Expense" : TYPE_LABELS[t.type]}
            </span>
            <Label color={TYPE_COLOR[t.type]}>{TYPE_LABELS[t.type]}</Label>
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
      <span
        className={`shrink-0 whitespace-nowrap text-sm font-semibold ${
          sign < 0 ? "text-danger" : sign > 0 ? "text-success" : "text-info"
        }`}
      >
        {sign < 0 ? "-" : sign > 0 ? "+" : ""}
        {inr(t.amount)}
      </span>
    </div>
  );
}
