"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, ArrowDownToLine, Building2, AlertTriangle } from "lucide-react";
import { Card, Label, Button, Spinner, EmptyState } from "@/components/ui";
import { useActions } from "@/components/ActionsProvider";
import { inr, formatDate, CATEGORY_ICON, siteStatus, LEVEL_LABEL, type SiteLevel } from "@/lib/format";
import { TxnRow } from "@/components/TxnRow";

const STATUS_COLOR: Record<string, string> = { active: "green", on_hold: "amber", completed: "blue" };
const STATUS_LABEL: Record<string, string> = { active: "Active", on_hold: "On Hold", completed: "Completed" };
const LEVEL_STYLE: Record<SiteLevel, string> = {
  ok: "bg-success/10 text-success",
  low: "bg-warning/10 text-warning",
  critical: "bg-danger/10 text-danger",
  none: "bg-muted text-muted-foreground",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { recordExpense, allocateFunds } = useActions();
  const [p, setP] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"activity" | "category" | "expenses">("activity");

  const load = useCallback(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => setP(j.data))
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  // Group transactions by day for the timeline
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const t of p?.transactions || []) {
      const key = t.txn_date;
      (g[key] ||= []).push(t);
    }
    return Object.entries(g);
  }, [p]);

  // Expenses only (for the dedicated Expenses section)
  const expenses = useMemo(
    () => (p?.transactions || []).filter((t: any) => t.type === "expense"),
    [p]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((s: number, t: any) => s + Number(t.amount), 0),
    [expenses]
  );

  if (notFound) return <p className="text-muted-foreground">Site not found.</p>;
  if (!p) return <Spinner />;

  const { runway, level } = siteStatus(p.balance, Number(p.spent14 || 0), Number(p.received || 0));

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4" /> Sites
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Building2 className="h-6 w-6 text-muted-foreground" /> {p.name}
        </h1>
        <Label color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status]}</Label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => allocateFunds(Number(id))}>
            <ArrowDownToLine className="h-4 w-4" /> Allocate
          </Button>
          <Button onClick={() => recordExpense(Number(id))}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Balance hero */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className={`mt-1 text-3xl font-bold ${p.balance < 0 ? "text-danger" : "text-foreground"}`}>
              {inr(p.balance)}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${LEVEL_STYLE[level]}`}>
            {level !== "ok" && <AlertTriangle className="h-3.5 w-3.5" />}
            {LEVEL_LABEL[level]}
            {runway !== null && p.balance > 0 && ` · ~${runway} days left`}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
          <Mini label="Received" value={inr(p.received)} className="text-success" />
          <Mini label="Spent" value={inr(p.spent)} className="text-danger" />
          <Mini label="Last Activity" value={p.last_txn_date ? formatDate(p.last_txn_date) : "—"} />
        </div>
      </Card>

      {/* Tabbed detail: Activity · Spend by Category · Expenses */}
      <Card className="overflow-hidden">
        <div className="flex gap-1 border-b border-border px-2">
          {([
            { key: "activity", label: "Activity" },
            { key: "category", label: "Spend by Category" },
            { key: "expenses", label: `Expenses (${expenses.length})` },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Activity */}
        {tab === "activity" &&
          (grouped.length === 0 ? (
            <EmptyState>No activity yet.</EmptyState>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {grouped.map(([day, items]) => (
                <div key={day}>
                  <div className="sticky top-0 bg-muted/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                    {formatDate(day)}
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((t: any) => (
                      <TxnRow key={t.id} t={{ ...t, project_name: p.name }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* Spend by Category */}
        {tab === "category" &&
          (p.byCategory.length === 0 ? (
            <EmptyState>No expenses yet.</EmptyState>
          ) : (
            <div className="space-y-3 p-4">
              {p.byCategory.map((c: any) => {
                const Icon = CATEGORY_ICON[c.category] || CATEGORY_ICON.Miscellaneous;
                const pct = p.spent > 0 ? Math.round((c.total / p.spent) * 100) : 0;
                return (
                  <div key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" /> {c.category}
                      </span>
                      <span className="font-medium">{inr(c.total)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* Expenses */}
        {tab === "expenses" &&
          (expenses.length === 0 ? (
            <EmptyState>No expenses yet.</EmptyState>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm text-muted-foreground">
                <span>{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}</span>
                <span className="font-semibold text-danger">{inr(totalExpenses)}</span>
              </div>
              <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
                {expenses.map((t: any) => (
                  <TxnRow key={t.id} t={{ ...t, project_name: p.name }} />
                ))}
              </div>
            </>
          ))}
      </Card>
    </div>
  );
}

function Mini({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-semibold ${className}`}>{value}</p>
    </div>
  );
}
