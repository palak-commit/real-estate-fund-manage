"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowDownToLine,
  Building2,
  ChevronRight,
  Wallet,
  Receipt,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  ClipboardList,
  Hourglass,
  CheckCircle,
} from "lucide-react";
import { Card, Skeleton, EmptyState, Button } from "@/components/ui";
import { useActions } from "@/components/ActionsProvider";
import { inr, PROFIT_LABEL, PROFIT_HINT, type ProfitLevel, type SiteLevel } from "@/lib/format";
import { TxnRow } from "@/components/TxnRow";
import MoneyStrip from "@/components/MoneyStrip";

type Site = {
  id: number;
  name: string;
  received: number;
  income: number;
  spent: number;
  balance: number;
  profit: number;
  profitLevel: ProfitLevel;
  burn: number;
  runway: number | null;
  level: SiteLevel; // funding health (ok / low / critical / none) from lib/format siteStatus
};

type Aging = { b0: number; b30: number; b60: number; b90: number; total: number };

type Dash = {
  availableToAllocate: number;
  totalMoney: number;
  bank: number;
  cash: number;
  partner: number;
  siteFunds: number;
  todayExpense: number;
  yesterdayExpense: number;
  monthExpense: number;
  pendingReceivable: number;
  pendingReceivableCount: number;
  pendingPayable: number;
  pendingPayableCount: number;
  payablesAging: Aging;
  receivablesAging: Aging;
  spentBank: number;
  spentCash: number;
  spentPartner: number;
  spentTotal: number;
  activeSites: number;
  totalIncome: number;
  sites: Site[];
  recent: any[];
  topPayables: { name: string; project_name: string; amount: number; days: number }[];
  topReceivables: { name: string; project_name: string; amount: number; days: number }[];
};

const PROFIT_STYLE: Record<ProfitLevel, string> = {
  profit: "bg-success/10 text-success",
  loss: "bg-danger/10 text-danger",
  even: "bg-muted text-muted-foreground",
};
// Progress bar color tracks profitability: green while spend is within income, red once
// spend has overtaken income (a loss).
const PROFIT_BAR: Record<ProfitLevel, string> = {
  profit: "bg-success",
  loss: "bg-danger",
  even: "bg-success",
};

export default function Home() {
  const { recordExpense, allocateFunds } = useActions();
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => setD(j.data))
      .catch(() => setErr("Could not load data. Make sure the database is running."));
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  if (err) return <p className="rounded-lg bg-danger/10 p-4 text-danger">{err}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {/* Money strip */}
      {!d ? <Skeleton className="h-28 w-full rounded-2xl" /> : <MoneyStrip d={d} />}

      {/* Needs attention — decision cards */}
      {!d ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <AttentionCards d={d} />
      )}

      {/* Cash-flow runway warning + top outstanding summary */}
      {/* Runway warning hidden for now — re-enable when needed:
      {d && <RunwayAlert sites={d.sites} />} */}
      {d && <TopOutstanding payables={d.topPayables} receivables={d.topReceivables} />}

      {/* Sites */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Sites</h2>
          <Link href="/projects" className="flex items-center text-sm text-primary hover:underline">
            Manage <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {!d ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : d.sites.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              action={
                <Link href="/projects">
                  <Button className="!py-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add your first site
                  </Button>
                </Link>
              }
            >
              No active sites yet. Create a site to start tracking its money.
            </EmptyState>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.sites.map((s) => {
              // % of income spent: how much of what the site earned has been spent (all spend).
              // No income yet → 100% if anything was spent (pure loss), else 0%.
              const pct =
                s.income > 0 ? Math.min(100, Math.round((s.spent / s.income) * 100)) : s.spent > 0 ? 100 : 0;
              return (
                <Card key={s.id} className="flex flex-col p-4">
                  <Link href={`/projects/${s.id}`} className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-semibold">
                        <Building2 className="h-4 w-4 text-muted-foreground" /> {s.name}
                      </h3>
                      {(s.income > 0 || s.spent > 0) && (
                        <span
                          title={PROFIT_HINT}
                          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${PROFIT_STYLE[s.profitLevel]}`}
                        >
                          {PROFIT_LABEL[s.profitLevel]} · {inr(Math.abs(s.profit))}
                        </span>
                      )}
                    </div>

                    <p className={`mt-3 text-2xl font-bold ${s.balance < 0 ? "text-danger" : "text-foreground"}`}>
                      {inr(s.balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">remaining site funds</p>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${PROFIT_BAR[s.profitLevel]}`} style={{ width: `${pct}%` }} />
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {s.income > 0 ? `${pct}% of income spent` : "No income yet"}
                      </p>
                      {s.runway !== null && (
                        <p className={`text-xs font-medium ${s.runway <= 7 ? "text-danger" : "text-amber-600"}`}>
                          {s.runway} Days Left
                        </p>
                      )}
                    </div>

                    {/* Income earned vs total spent on the site */}
                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs">
                      <span className="text-muted-foreground">
                        Revenue <span className="font-semibold text-success">{inr(s.income)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Spent <span className="font-semibold text-danger">{inr(s.spent)}</span>
                      </span>
                    </div>
                  </Link>

                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" onClick={() => allocateFunds(s.id)} className="flex-1 !py-1.5 text-xs">
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Add Site Fund
                    </Button>
                    <Button onClick={() => recordExpense(s.id)} className="flex-1 !py-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Expense
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Today's Action Plan (AI Synthesis) - moved after Sites per user request */}
      {d && <TodaysAction d={d} />}

      {/* Recent activity */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">Recent Activity</h2>
          <Link href="/transactions" className="flex items-center text-sm text-primary hover:underline">
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {!d ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : d.recent.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            action={
              <Button onClick={() => recordExpense()} className="!py-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Record an expense
              </Button>
            }
          >
            No activity yet. Your transactions will show up here.
          </EmptyState>
        ) : (
          <div className="divide-y divide-border">
            {d.recent.map((t) => (
              <TxnRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Four decision cards an owner needs at a glance: what's owed to me, what I spent yesterday,
// which sites are out of money, and which sites are winning/losing.
// Plain-language cash-flow runway warning: which funded sites will run out of money soon,
// based on the 14-day burn rate. Renders nothing when no site is at risk.
// Currently hidden on the dashboard (render call commented out above); kept for re-enabling.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RunwayAlert({ sites }: { sites: Site[] }) {
  const atRisk = sites
    .filter((s) => s.level === "low" && s.runway != null)
    .sort((a, b) => (a.runway ?? 0) - (b.runway ?? 0));
  if (!atRisk.length) return null;
  const days = (n: number) => (n <= 0 ? "today" : `~${n} day${n === 1 ? "" : "s"}`);
  return (
    <Card className="border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2.5">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">Cash runway warning</p>
          <ul className="mt-1 space-y-0.5 text-sm text-amber-900/80">
            {atRisk.map((s) => (
              <li key={s.id}>
                <Link href={`/projects/${s.id}`} className="hover:underline">
                  <span className="font-medium">{s.name}</span> runs out of funds in {days(s.runway as number)}
                  <span className="text-amber-900/60"> · ~{inr(Math.round(s.burn))}/day on average</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-amber-900/55">
            Estimate based on the average daily site spend over the last 14 days — actual day-to-day spending varies.
          </p>
        </div>
      </div>
    </Card>
  );
}

// Actionable checklist synthesized from the most urgent pending items.
function TodaysAction({ d }: { d: Dash }) {
  const actions: { text: string; icon: React.ReactNode; href: string }[] = [];

  // 1. Top Payable (most overdue / highest amount)
  if (d.topPayables.length > 0) {
    const p = d.topPayables[0];
    actions.push({
      text: `Pay ${p.name} ${inr(p.amount)}`,
      icon: <ClipboardList className="h-4 w-4 text-danger" />,
      href: "/vendor-bills",
    });
  }

  // 2. Top Receivable
  if (d.topReceivables.length > 0) {
    const r = d.topReceivables[0];
    actions.push({
      text: `Collect ${inr(r.amount)} from ${r.name}`,
      icon: <Receipt className="h-4 w-4 text-success" />,
      href: "/ra-receipts",
    });
  }

  // 3. Urgent Sites (Runway <= 7 days or Balance <= 0)
  // Sort by balance (lowest first) to prioritize the most critical.
  const urgentSites = d.sites
    .filter((s) => s.balance <= 0 || (s.runway !== null && s.runway <= 7))
    .sort((a, b) => a.balance - b.balance);
    
  if (urgentSites.length > 0) {
    urgentSites.slice(0, 2).forEach((s) => {
      let msg = "";
      if (s.balance <= 0) msg = `${s.name} needs funds immediately (Balance: ${inr(s.balance)})`;
      else msg = `${s.name} needs funds in ${s.runway} days`;

      actions.push({
        text: msg,
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        href: `/projects/${s.id}`,
      });
    });
  }

  if (actions.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-primary bg-primary/5 p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-primary">
        <CheckCircle className="h-5 w-5" /> Today's Action Plan
      </h2>
      <ul className="space-y-3">
        {actions.map((a, i) => (
          <li key={i}>
            <Link href={a.href} className="flex items-center gap-3 text-sm hover:underline">
              <span className="shrink-0 rounded-full bg-background p-1.5 shadow-sm">
                {a.icon}
              </span>
              <span className="font-medium text-foreground/90">{a.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Compact list of who needs to be paid (Vendors) and who owes us (Clients/Sites).
function TopOutstanding({ payables, receivables }: { payables: Dash["topPayables"]; receivables: Dash["topReceivables"] }) {
  if (payables.length === 0 && receivables.length === 0) return null;
  
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {payables.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-danger">
              <ClipboardList className="h-4 w-4" /> Top Payables (To Pay)
            </h2>
            <Link href="/vendor-bills" className="text-xs text-primary hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {payables.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.project_name ? `${p.project_name} · ` : ""}Overdue by {p.days} days
                  </p>
                </div>
                <p className="font-semibold">{inr(p.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {receivables.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-success">
              <Receipt className="h-4 w-4" /> Top Receivables (To Collect)
            </h2>
            <Link href="/ra-receipts" className="text-xs text-primary hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {receivables.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.project_name ? `${r.project_name} · ` : ""}Pending for {r.days} days
                  </p>
                </div>
                <p className="font-semibold">{inr(r.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function AttentionCards({ d }: { d: Dash }) {
  // Sites out of money (balance ≤ 0), worst first.
  const needFunds = d.sites
    .filter((s) => s.balance <= 0)
    .sort((a, b) => a.balance - b.balance);
  // Profit leaderboard among sites with any activity.
  const active = d.sites.filter((s) => s.income > 0 || s.spent > 0);
  const best = active.length ? active.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
  const worst = active.length ? active.reduce((a, b) => (b.profit < a.profit ? b : a)) : null;

  // Cashflow heads-up: payables in the market vs. liquid money on hand (Bank + Cash).
  const liquid = d.bank + d.cash;
  const payableShort = d.pendingPayable > liquid;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* Pending receivables */}
      <Link href="/ra-receipts">
        <Card className="flex h-full flex-col p-4 transition hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Receipt className="h-4 w-4" /> Pending Receivable
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{inr(d.pendingReceivable)}</p>
          <p className="mt-auto pt-2 text-xs text-muted-foreground">
            {d.pendingReceivableCount > 0
              ? `${d.pendingReceivableCount} RA bill${d.pendingReceivableCount > 1 ? "s" : ""} to collect`
              : "All bills collected 🎉"}
          </p>
        </Card>
      </Link>

      {/* Pending payables — money owed to vendors, not yet paid */}
      <Link href="/vendor-bills">
        <Card className="flex h-full flex-col p-4 transition hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ClipboardList className={`h-4 w-4 ${payableShort ? "text-danger" : ""}`} /> Pending Payable
          </div>
          <p className={`mt-2 text-2xl font-bold ${payableShort ? "text-danger" : "text-foreground"}`}>
            {inr(d.pendingPayable)}
          </p>
          <p className="mt-auto pt-2 text-xs text-muted-foreground">
            {d.pendingPayableCount > 0
              ? payableShort
                ? `Exceeds ${inr(liquid)} on hand — arrange funds`
                : `${d.pendingPayableCount} bill${d.pendingPayableCount > 1 ? "s" : ""} to pay`
              : "All vendors paid 🎉"}
          </p>
        </Card>
      </Link>

      {/* Daily Expense */}
      <Card className="flex h-full flex-col p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> Daily Expense
        </div>
        <p className="mt-2 text-2xl font-bold text-foreground">
          <span className="text-sm font-normal text-muted-foreground">Today</span> <br />
          {inr(d.todayExpense)}
        </p>
        <p className="mt-auto pt-2 text-xs text-muted-foreground">Yesterday: {inr(d.yesterdayExpense)}</p>
      </Card>

      {/* Sites needing funds */}
      <Link href="/projects">
        <Card className="flex h-full flex-col p-4 transition hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground" title="Sites with balance at or below 0">
            <AlertTriangle className={`h-4 w-4 ${needFunds.length ? "text-danger" : ""}`} /> Needs Funds (≤ 0)
          </div>
          <p className={`mt-2 text-2xl font-bold ${needFunds.length ? "text-danger" : "text-foreground"}`}>
            {needFunds.length}
          </p>
          <p className="mt-auto truncate pt-2 text-xs text-muted-foreground">
            {needFunds.length ? needFunds.slice(0, 2).map((s) => s.name).join(", ") : "Every site funded ✅"}
          </p>
        </Card>
      </Link>

      {/* Profit leaderboard */}
      <Card className="flex h-full flex-col p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <TrendingUp className="h-4 w-4" /> Profit Leaders (Best & Worst)
        </div>
        {best ? (
          <div className="mt-2 space-y-1 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">{best.name}</span>
              <span className="shrink-0 font-semibold text-success">{inr(best.profit)}</span>
            </p>
            {worst && worst.id !== best.id && (
              <p className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">{worst.name}</span>
                <span className={`shrink-0 font-semibold ${worst.profit < 0 ? "text-danger" : "text-success"}`}>
                  {inr(worst.profit)}
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No site income yet</p>
        )}
        <Link href="/reports" className="mt-auto pt-2 text-xs text-primary hover:underline">
          View all sites →
        </Link>
      </Card>
    </div>
  );
}

