"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowDownToLine, Building2, ChevronRight, Wallet } from "lucide-react";
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
  monthExpense: number;
  spentBank: number;
  spentCash: number;
  spentPartner: number;
  spentTotal: number;
  activeSites: number;
  totalProfit: number;
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
            <EmptyState icon={<Building2 className="h-6 w-6" />}>
              No active sites yet. Add one under “Manage”.
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
          <EmptyState icon={<Wallet className="h-6 w-6" />}>No activity yet.</EmptyState>
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

