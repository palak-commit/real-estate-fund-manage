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
} from "lucide-react";
import { Card, Skeleton, EmptyState, Button } from "@/components/ui";
import { useActions } from "@/components/ActionsProvider";
import { inr, PROFIT_LABEL, PROFIT_HINT, type ProfitLevel } from "@/lib/format";
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
};

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
  spentBank: number;
  spentCash: number;
  spentPartner: number;
  spentTotal: number;
  activeSites: number;
  totalProfit: number;
  totalIncome: number;
  sites: Site[];
  recent: any[];
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
                    <p className="text-xs text-muted-foreground">available balance</p>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${PROFIT_BAR[s.profitLevel]}`} style={{ width: `${pct}%` }} />
                    </div>

                    {/* % of income spent, shown below the progress bar */}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {s.income > 0 ? `${pct}% of income spent` : "No income yet"}
                    </p>

                    {/* Income earned vs total spent on the site */}
                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs">
                      <span className="text-muted-foreground">
                        Income <span className="font-semibold text-success">{inr(s.income)}</span>
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
function AttentionCards({ d }: { d: Dash }) {
  // Sites out of money (balance ≤ 0), worst first.
  const needFunds = d.sites
    .filter((s) => s.balance <= 0)
    .sort((a, b) => a.balance - b.balance);
  // Profit leaderboard among sites with any activity.
  const active = d.sites.filter((s) => s.income > 0 || s.spent > 0);
  const best = active.length ? active.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
  const worst = active.length ? active.reduce((a, b) => (b.profit < a.profit ? b : a)) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Yesterday spend */}
      <Card className="flex h-full flex-col p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> Spent Yesterday
        </div>
        <p className="mt-2 text-2xl font-bold text-foreground">{inr(d.yesterdayExpense)}</p>
        <p className="mt-auto pt-2 text-xs text-muted-foreground">Today {inr(d.todayExpense)}</p>
      </Card>

      {/* Sites needing funds */}
      <Link href="/projects">
        <Card className="flex h-full flex-col p-4 transition hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle className={`h-4 w-4 ${needFunds.length ? "text-danger" : ""}`} /> Needs Funds
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
          <TrendingUp className="h-4 w-4" /> Profit Leaders
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

