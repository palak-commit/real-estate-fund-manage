"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, List } from "lucide-react";
import { Card, CustomDatePicker, Skeleton, EmptyState } from "@/components/ui";
import { inr, todayISO, CATEGORY_ICON, PROFIT_HINT } from "@/lib/format";
import MoneyStrip, { type MoneyStripData } from "@/components/MoneyStrip";

type Report = {
  sites: {
    id: number;
    name: string;
    received: number;
    income: number;
    spent: number;
    spent_site: number;
    spent_direct: number;
    balance: number;
    profit: number;
  }[];
  categories: { category: string; total: number; count: number }[];
  partners: { id: number; name: string; contributed: number; withdrawn: number; outstanding: number }[];
};

type Dash = MoneyStripData;

function rangeFor(preset: string): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toLocaleDateString("en-CA");
  const to = iso(now);
  if (preset === "today") return { from: to, to };
  if (preset === "week") {
    const d = new Date(now);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return { from: iso(d), to };
  }
  if (preset === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  return { from: "", to: "" };
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

export default function ReportsPage() {
  const router = useRouter();
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState<{ from: string; to: string }>(() => rangeFor("month"));
  const [r, setR] = useState<Report | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [tab, setTab] = useState<"site" | "category">("site");
  const [view, setView] = useState<"table" | "chart">("table");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((j) => setDash(j.data))
      .catch(() => {});
  }, []);

  // Click a preset → fill the date fields with that range; editing a date → custom range.
  const pickPreset = (key: string) => {
    setPreset(key);
    setRange(rangeFor(key));
  };
  const setDate = (which: "from" | "to", val: string) => {
    setPreset(""); // manual date edit = no active preset
    setRange((rg) => ({ ...rg, [which]: val }));
  };

  const load = useCallback(() => {
    setR(null);
    const qs = new URLSearchParams();
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    fetch(`/api/reports?${qs}`).then((res) => res.json()).then((j) => setR(j.data));
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      {/* Money strip (shared with the Dashboard) */}
      {!dash ? <Skeleton className="h-28 w-full rounded-2xl" /> : <MoneyStrip d={dash} />}

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => pickPreset(p.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              preset === p.key ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <CustomDatePicker
            value={range.from}
            onChange={(val) => setDate("from", val)}
            onClear={() => setDate("from", "")}
            maxDate={range.to || undefined}
            className="w-36"
          />
          <span className="text-muted-foreground">to</span>
          <CustomDatePicker
            value={range.to}
            onChange={(val) => setDate("to", val)}
            onClear={() => setDate("to", "")}
            minDate={range.from || undefined}
            className="w-36"
            align="right"
          />
        </div>
      </div>

      {!r ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Tabs: By Site · By Category + Table/Chart toggle */}
          <div className="flex items-center justify-between border-b border-border px-2">
            <div className="flex gap-1">
              {([
                { key: "site", label: "By Site" },
                { key: "category", label: "By Category" },
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
            <button
              onClick={() => setView((v) => (v === "table" ? "chart" : "table"))}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {view === "table" ? (
                <>
                  <BarChart3 className="h-3.5 w-3.5" /> Chart
                </>
              ) : (
                <>
                  <List className="h-3.5 w-3.5" /> Table
                </>
              )}
            </button>
          </div>

          {/* Chart view (current tab's spend as a pie) */}
          {view === "chart" && (
            <PieChart
              items={
                tab === "site"
                  ? r.sites.map((s) => ({ label: s.name, value: s.spent }))
                  : r.categories.map((c) => ({ label: c.category, value: c.total }))
              }
            />
          )}

          {/* By Site */}
          {view === "table" && tab === "site" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Site</th>
                    <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                    <th className="px-4 py-2.5 text-right font-medium">Spent · Site funds</th>
                    <th className="px-4 py-2.5 text-right font-medium">Spent · Direct</th>
                    <th className="px-4 py-2.5 text-right font-medium" title={PROFIT_HINT}>
                      Profit / Loss
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">Site Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {r.sites.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/projects/${s.id}`)}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 text-right text-success">{inr(s.income)}</td>
                      <td className="px-4 py-2.5 text-right text-danger">{inr(s.spent_site)}</td>
                      <td className="px-4 py-2.5 text-right text-danger">{inr(s.spent_direct)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${s.profit < 0 ? "text-danger" : "text-success"}`}>
                        {s.profit < 0 ? "-" : "+"}
                        {inr(Math.abs(s.profit))}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${s.balance < 0 ? "text-danger" : ""}`}>
                        {inr(s.balance)}
                      </td>
                    </tr>
                  ))}
                  {r.sites.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState>No data for this range.</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
                {r.sites.length > 0 && (
                  <tfoot className="border-t-2 border-border bg-muted/50">
                    <tr className="font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right text-success">
                        {inr(r.sites.reduce((s, x) => s + x.income, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right text-danger">
                        {inr(r.sites.reduce((s, x) => s + x.spent_site, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right text-danger">
                        {inr(r.sites.reduce((s, x) => s + x.spent_direct, 0))}
                      </td>
                      {(() => {
                        const totalProfit = r.sites.reduce((s, x) => s + x.profit, 0);
                        return (
                          <td className={`px-4 py-2.5 text-right ${totalProfit < 0 ? "text-danger" : "text-success"}`}>
                            {totalProfit < 0 ? "-" : "+"}
                            {inr(Math.abs(totalProfit))}
                          </td>
                        );
                      })()}
                      <td className="px-4 py-2.5 text-right">
                        {inr(r.sites.reduce((s, x) => s + x.balance, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* By Category */}
          {view === "table" && tab === "category" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 text-right font-medium">Count</th>
                    <th className="px-4 py-2.5 text-right font-medium">Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {r.categories.map((c) => {
                    const Icon = CATEGORY_ICON[c.category] || CATEGORY_ICON.Miscellaneous;
                    return (
                      <tr key={c.category}>
                        <td className="px-4 py-2.5 font-medium">
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" /> {c.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{c.count}</td>
                        <td className="px-4 py-2.5 text-right text-danger">{inr(c.total)}</td>
                      </tr>
                    );
                  })}
                  {r.categories.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState>No expenses in this range.</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
                {r.categories.length > 0 && (
                  <tfoot className="border-t-2 border-border bg-muted/50">
                    <tr className="font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {r.categories.reduce((s, x) => s + x.count, 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-danger">
                        {inr(r.categories.reduce((s, x) => s + x.total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

const PIE_COLORS = ["#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];

function PieChart({ items }: { items: { label: string; value: number }[] }) {
  const data = items.filter((i) => i.value > 0);
  const total = data.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return <EmptyState>No spending in this range.</EmptyState>;

  const r = 60;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segments = data.map((it, idx) => {
    const frac = it.value / total;
    const len = frac * C;
    const seg = {
      ...it,
      frac,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      dash: `${len} ${C - len}`,
      offset: -acc,
    };
    acc += len;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-6 p-5 sm:flex-row sm:justify-center sm:gap-10">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        <g transform="rotate(-90 80 80)">
          {segments.map((s) => (
            <circle
              key={s.label}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="26"
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
            />
          ))}
        </g>
        <text x="80" y="76" textAnchor="middle" className="fill-current text-muted-foreground text-[10px]">Total</text>
        <text x="80" y="92" textAnchor="middle" className="fill-current text-foreground text-sm font-semibold">{inr(total)}</text>
      </svg>
      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="font-medium">{s.label}</span>
            <span className="text-muted-foreground">
              {inr(s.value)} · {Math.round(s.frac * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

