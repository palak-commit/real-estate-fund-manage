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
  totalIncome: number;
  spentBank: number;
  spentCash: number;
  spentPartner: number;
  spentTotal: number;
};

export default function MoneyStrip({ d }: { d: MoneyStripData }) {
  return (
    <div className="rounded-2xl bg-sidebar p-5 text-white">
      <div className="flex flex-wrap items-end gap-6 lg:gap-12">
        <div>
          <p className="text-sm font-medium text-white/70">Liquid Cash (Bank + Cash)</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-success">{inr(d.bank + d.cash)}</p>
        </div>
        <div className="mb-1 border-l border-white/20 pl-6">
          <p className="text-xs text-white/50">Company Net Money</p>
          <p className="text-xl font-medium tracking-tight text-white/80">{inr(d.totalMoney)}</p>
        </div>
      </div>

      {/* Two partitions: current balance (left) vs money spent out of each account (right). */}
      <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-2 lg:gap-0">
        <div className="lg:pr-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Current Balance</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-2">
            <Strip label="Bank" value={inr(d.bank)} />
            <Strip label="Cash" value={inr(d.cash)} />
            <Strip label="Partner Funds" value={inr(d.partner)} />
            <Strip label="Allocated to Sites" value={inr(d.siteFunds)} />
          </div>
        </div>
        <div className="border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40" title="Includes both actual expenses and money allocated to sites">Money Out (All Time)</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-2">
            <Strip label="Bank" value={inr(d.spentBank)} />
            <Strip label="Cash" value={inr(d.spentCash)} />
            <Strip label="Partner" value={inr(d.spentPartner)} />
            <Strip
              label="Total Outflow"
              title="Actual Expenses + In Sites Balance"
              value={inr(d.spentTotal)}
              valueClassName="text-danger"
              subtext={`${inr(d.totalIncome - d.totalProfit)} (Exp) + ${inr(d.siteFunds)} (Site)`}
            />
          </div>
        </div>
      </div>

      {/* Footer: time-boxed spend + total expenses + income earned + overall profit/loss. */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <Strip label="Spent Today" value={inr(d.todayExpense)} />
        <Strip label="This Month" value={inr(d.monthExpense)} />
        <Strip label="Company Total Expenses" title="Total money actually spent across all sites" value={inr(d.totalIncome - d.totalProfit)} valueClassName="text-danger" />
        <Strip label="Revenue Earned" value={inr(d.totalIncome)} valueClassName="text-success" />
        <Strip
          label="Overall Profit / Loss"
          title={PROFIT_HINT}
          value={`${d.totalProfit < 0 ? "-" : "+"}${inr(Math.abs(d.totalProfit))}`}
          valueClassName={d.totalProfit < 0 ? "text-danger" : "text-success"}
          subtext={`${inr(d.totalIncome)} - ${inr(d.totalIncome - d.totalProfit)}`}
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
  subtext,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
  subtext?: string;
}) {
  return (
    <div>
      <p className="text-xs text-white/60" title={title}>
        {label}
      </p>
      <p className={`mt-0.5 font-semibold ${valueClassName}`}>{value}</p>
      {subtext && <p className="mt-0.5 text-[10px] text-white/40">{subtext}</p>}
    </div>
  );
}
