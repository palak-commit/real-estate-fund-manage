import { inr, PROFIT_HINT } from "@/lib/format";

// The dark "Total Capital" summary strip shown at the top of the Dashboard and Reports.
// Shared so both screens stay identical. Fed by the /api/dashboard payload.
export type MoneyStripData = {
  totalMoney: number;
  bank: number;
  cash: number;
  partner: number;
  siteFunds: number;
  todayExpense: number;
  monthExpense: number;
  totalProfit: number;
};

export default function MoneyStrip({ d }: { d: MoneyStripData }) {
  return (
    <div className="rounded-2xl bg-sidebar p-5 text-white">
      <p className="text-sm text-white/70">Total Capital (Bank + Cash + Partner)</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{inr(d.totalMoney)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-4">
        <Strip label="Bank" value={inr(d.bank)} />
        <Strip label="Cash" value={inr(d.cash)} />
        <Strip label="Partner Funds" value={inr(d.partner)} />
        <Strip label="In Sites" value={inr(d.siteFunds)} />
        <Strip label="Spent Today" value={inr(d.todayExpense)} />
        <Strip label="This Month" value={inr(d.monthExpense)} />
        <Strip
          label="Profit / Loss"
          title={PROFIT_HINT}
          value={`${d.totalProfit < 0 ? "-" : "+"}${inr(Math.abs(d.totalProfit))}`}
          valueClassName={d.totalProfit < 0 ? "text-danger" : "text-success"}
        />
      </div>
    </div>
  );
}

function Strip({
  label,
  value,
  valueClassName = "",
  title,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div>
      <p className="text-xs text-white/60" title={title}>
        {label}
      </p>
      <p className={`mt-0.5 font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}
