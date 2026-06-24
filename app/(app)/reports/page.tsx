"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CustomDatePicker, Spinner, EmptyState } from "@/components/ui";
import { inr, CATEGORY_ICON, todayISO } from "@/lib/format";

type Report = {
  sites: { id: number; name: string; received: number; spent: number; balance: number }[];
  categories: { category: string; total: number; count: number }[];
  partners: { id: number; name: string; contributed: number; withdrawn: number; outstanding: number }[];
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
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState({ from: todayISO(), to: todayISO() });
  const [r, setR] = useState<Report | null>(null);

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

  const catTotal = r?.categories.reduce((s, c) => s + c.total, 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

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
        <Spinner />
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
                    <th className="px-4 py-2.5 text-right font-medium">Received</th>
                    <th className="px-4 py-2.5 text-right font-medium">Spent</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {r.sites.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 text-right text-success">{inr(s.received)}</td>
                      <td className="px-4 py-2.5 text-right text-danger">{inr(s.spent)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${s.balance < 0 ? "text-danger" : ""}`}>
                        {inr(s.balance)}
                      </td>
                    </tr>
                  ))}
                  {r.sites.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState>No data for this range.</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Category Report */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold">Category Report</h2>
              <span className="text-sm font-semibold">{inr(catTotal)}</span>
            </div>
            {r.categories.length === 0 ? (
              <EmptyState>No expenses in this range.</EmptyState>
            ) : (
              <div className="divide-y divide-border">
                {r.categories.map((c) => {
                  const Icon = CATEGORY_ICON[c.category] || CATEGORY_ICON.Miscellaneous;
                  return (
                    <div key={c.category} className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-sm">
                        <Icon className="h-4 w-4 text-muted-foreground" /> {c.category}
                        <span className="text-xs text-muted-foreground">({c.count})</span>
                      </span>
                      <span className="font-semibold">{inr(c.total)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Partner Report */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Partner Report</h2>
            </div>
            {r.partners.length === 0 ? (
              <EmptyState>No partners yet.</EmptyState>
            ) : (
              <div className="divide-y divide-border">
                {r.partners.map((p) => (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.name}</span>
                      <span className="font-bold">{inr(p.outstanding)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Contributed {inr(p.contributed)} · Withdrawn {inr(p.withdrawn)} · Outstanding (total)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
