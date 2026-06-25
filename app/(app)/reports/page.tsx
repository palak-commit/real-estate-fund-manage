"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CustomDatePicker, Skeleton, EmptyState } from "@/components/ui";
import { inr, todayISO } from "@/lib/format";

type Report = {
  sites: { id: number; name: string; received: number; spent: number; balance: number }[];
  categories: { category: string; total: number; count: number }[];
  partners: { id: number; name: string; contributed: number; withdrawn: number; outstanding: number }[];
};

type Dash = {
  totalMoney: number;
  bank: number;
  cash: number;
  partner: number;
  siteFunds: number;
  todayExpense: number;
  monthExpense: number;
};

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
  { key: "custom", label: "Custom" },
];

export default function ReportsPage() {
  const router = useRouter();
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState({ from: todayISO(), to: todayISO() });
  const [r, setR] = useState<Report | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((j) => setDash(j.data))
      .catch(() => {});
  }, []);

  const range = useMemo(() => (preset === "custom" ? custom : rangeFor(preset)), [preset, custom]);

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

      {/* Money strip (same as Dashboard) */}
      {!dash ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : (
        <div className="rounded-2xl bg-sidebar p-5 text-white">
          <p className="text-sm text-white/70">Total Capital (Bank + Cash + Partner)</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{inr(dash.totalMoney)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-4">
            <Strip label="Bank" value={inr(dash.bank)} />
            <Strip label="Cash" value={inr(dash.cash)} />
            <Strip label="Partner Funds" value={inr(dash.partner)} />
            <Strip label="In Sites" value={inr(dash.siteFunds)} />
            <Strip label="Spent Today" value={inr(dash.todayExpense)} />
            <Strip label="This Month" value={inr(dash.monthExpense)} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              preset === p.key ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <CustomDatePicker value={custom.from} onChange={(val) => setCustom({ ...custom, from: val })} className="w-32" />
            <span className="text-muted-foreground">to</span>
            <CustomDatePicker value={custom.to} onChange={(val) => setCustom({ ...custom, to: val })} className="w-32" align="right" />
          </div>
        )}
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
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Site Report */}
          <Card className="overflow-hidden lg:col-span-2">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Site Report</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Site</th>
                    <th className="px-4 py-2.5 text-right font-medium">Spent</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
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
                      <td className="px-4 py-2.5 text-right text-danger">{inr(s.spent)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${s.balance < 0 ? "text-danger" : ""}`}>
                        {inr(s.balance)}
                      </td>
                    </tr>
                  ))}
                  {r.sites.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState>No data for this range.</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
                {r.sites.length > 0 && (
                  <tfoot className="border-t-2 border-border bg-muted/50">
                    <tr className="font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right text-danger">
                        {inr(r.sites.reduce((s, x) => s + x.spent, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {inr(r.sites.reduce((s, x) => s + x.balance, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

        </div>
      )}
    </div>
  );
}

function Strip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
