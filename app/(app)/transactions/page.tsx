"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Card, CustomSelect, CustomDatePicker, Button, EmptyState } from "@/components/ui";
import { TxnRow } from "@/components/TxnRow";
import PaidToPicker from "@/components/PaidToPicker";
import { useUI } from "@/components/UIProvider";
import { TYPE_LABELS, inr, todayISO } from "@/lib/format";

type Project = { id: number; name: string };
type Account = { id: number; name: string; account_type: string };
type Category = { id: number; name: string; subheads: { id: number; name: string }[] };
type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
const PAGE_SIZE = 15;

// Type filter options. `income` / `funds_added` both map to the income DB type but are
// split by whether a site is tagged (see the transactions API). Labels for the summary
// line live in TYPE_FILTER_LABEL below.
const TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Transfer", value: "transfer" },
  { label: "Expense", value: "expense" },
  { label: "Funds Added", value: "funds_added" },
  { label: "Income", value: "income" },
  { label: "Partner Payout", value: "partner_withdrawal" },
];
const TYPE_FILTER_LABEL: Record<string, string> = {
  transfer: "Transfer",
  expense: "Expense",
  funds_added: "Funds Added",
  income: "Income",
  partner_withdrawal: "Partner Payout",
};

function ListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
          <div className="skeleton h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function HistoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, confirm } = useUI();
  const [txns, setTxns] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState("");
  const [projectId, setProjectId] = useState("");
  const [head, setHead] = useState(""); // category Head (top level)
  const [category, setCategory] = useState(""); // Sub-Head (leaf), only within the chosen head
  // Initialise from ?account=<id> on the FIRST render so only one (correct) fetch runs —
  // avoids a race where an unfiltered fetch overwrites the filtered result.
  const [account, setAccount] = useState(searchParams.get("account") || "");
  const [paidTo, setPaidTo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pg, setPg] = useState<Pagination | null>(null);
  const [sumAmount, setSumAmount] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Shared filter params for both the list fetch and the export.
  const applyFilters = (qs: URLSearchParams) => {
    if (type) qs.set("type", type);
    if (projectId) qs.set("project_id", projectId);
    if (head) qs.set("head", head);
    if (category) qs.set("category", category);
    if (account) qs.set("account", account);
    if (paidTo) qs.set("paid_to", paidTo);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
  };

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [type, projectId, head, category, account, paidTo, from, to]);

  const load = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    applyFilters(qs);
    fetch(`/api/transactions?${qs}`)
      .then((r) => r.json())
      .then((res) => {
        setTxns(res.data ?? []);
        setPg(res.pagination ?? null);
        setSumAmount(res.summary?.amount ?? 0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, projectId, head, category, account, paidTo, from, to, page]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data));
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategories(j.data));
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data));
  }, []);

  // Pre-apply an account filter when opened from the Accounts page (?account=<id>).
  useEffect(() => {
    const acc = searchParams.get("account");
    if (acc) setAccount(acc);
  }, [searchParams]);

  const hasFilters = !!(type || projectId || head || category || account || paidTo || from || to);
  function clearFilters() {
    setType("");
    setProjectId("");
    setHead("");
    setCategory("");
    setAccount("");
    setPaidTo("");
    setFrom("");
    setTo("");
  }

  // Sub-heads of the currently-selected Head (for the cascading Sub-category filter).
  const selectedHead = categories.find((h) => h.name === head);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  async function deleteTxn(t: any) {
    const okToDelete = await confirm({
      title: "Delete transaction?",
      message: `This ${TYPE_LABELS[t.type]?.toLowerCase() || ""} of ${inr(t.amount)} will be removed and balances recalculated.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!okToDelete) return;
    const res = await fetch(`/api/transactions/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast((await res.json()).message || "Could not delete", "error");
      return;
    }
    toast("Transaction deleted", "success");
    window.dispatchEvent(new CustomEvent("txn:created"));
  }

  // Export ALL transactions matching the current filters (across pages) to a CSV
  // that opens cleanly in Excel.
  async function exportCsv() {
    setExporting(true);
    try {
      const all: any[] = [];
      let p = 1;
      // Pull every matching page (API caps limit at 200).
      while (true) {
        const qs = new URLSearchParams({ limit: "200", page: String(p) });
        applyFilters(qs);
        const res = await fetch(`/api/transactions?${qs}`).then((r) => r.json());
        all.push(...(res.data ?? []));
        if (!res.pagination?.hasNextPage) break;
        p++;
      }

      const headers = ["Date", "Type", "Category", "Site", "Source", "Destination", "Paid To", "Amount", "Note"];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = all.map((t) =>
        [
          t.txn_date,
          TYPE_LABELS[t.type] || t.type,
          t.category || "",
          t.project_name || "",
          t.source_name || (t.type === "expense" && !t.source_account_id ? "Site funds" : ""),
          t.dest_name || "",
          t.paid_to || "",
          Number(t.amount),
          t.note || "",
        ]
          .map(esc)
          .join(",")
      );
      // BOM so Excel reads UTF-8 (₹, names) correctly.
      const csv = "﻿" + [headers.map(esc).join(","), ...lines].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${todayISO()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported ${all.length} transaction${all.length === 1 ? "" : "s"}`, "success");
    } catch {
      toast("Could not export", "error");
    } finally {
      setExporting(false);
    }
  }

  const rangeStart = pg && pg.total > 0 ? (pg.page - 1) * pg.limit + 1 : 0;
  const rangeEnd = pg ? Math.min(pg.page * pg.limit, pg.total) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>

      <div className="flex flex-wrap items-end gap-3">
        <Filter label="Type">
          <CustomSelect
            value={type}
            onChange={(val) => setType(val)}
            onClear={() => setType("")}
            options={TYPE_FILTER_OPTIONS}
            placeholder="All Types"
            className="w-40"
          />
        </Filter>
        <Filter label="Site">
          <CustomSelect
            value={projectId}
            onChange={(val) => setProjectId(val)}
            onClear={() => setProjectId("")}
            options={[
              { label: "All Sites", value: "" },
              ...projects.map((p) => ({ label: p.name, value: String(p.id) }))
            ]}
            placeholder="All Sites"
            className="w-40"
          />
        </Filter>
        <Filter label="Category">
          <CustomSelect
            value={head}
            onChange={(val) => {
              setHead(val);
              setCategory(""); // reset sub-category when the head changes
            }}
            onClear={() => {
              setHead("");
              setCategory("");
            }}
            options={[
              { label: "All Categories", value: "" },
              ...categories.map((h) => ({ label: h.name, value: h.name })),
            ]}
            placeholder="All Categories"
            className="w-40"
          />
        </Filter>
        <Filter label="Sub-category">
          <CustomSelect
            value={category}
            onChange={(val) => setCategory(val)}
            onClear={() => setCategory("")}
            disabled={!selectedHead}
            options={[
              { label: "All Sub-categories", value: "" },
              ...(selectedHead?.subheads ?? []).map((s) => ({ label: s.name, value: s.name })),
            ]}
            placeholder={selectedHead ? "All Sub-categories" : "Select a category first"}
            className="w-44"
          />
        </Filter>
        <Filter label="Account">
          <CustomSelect
            value={account}
            onChange={(val) => setAccount(val)}
            onClear={() => setAccount("")}
            options={[
              { label: "All Accounts", value: "" },
              ...accounts.map((a) => ({ label: a.name, value: String(a.id) }))
            ]}
            placeholder="All Accounts"
            className="w-40"
          />
        </Filter>
        <Filter label="Paid To">
          <div className="w-40">
            <PaidToPicker value={paidTo} onChange={setPaidTo} placeholder="All Payees" allowAdd={false} />
          </div>
        </Filter>
        <Filter label="From">
          <CustomDatePicker value={from} onChange={(val) => setFrom(val)} onClear={() => setFrom("")} maxDate={to || undefined} className="w-40" />
        </Filter>
        <Filter label="To">
          <CustomDatePicker value={to} onChange={(val) => setTo(val)} onClear={() => setTo("")} minDate={from || undefined} className="w-40" align="right" />
        </Filter>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-[42px] rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:bg-muted"
          >
            Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            onClick={exportCsv}
            loading={exporting}
            disabled={!pg || pg.total === 0}
            className="!py-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{pg ? `${pg.total} entries` : "—"}</p>
            {pg &&
              pg.total > 0 &&
              (() => {
                // Show a total only when the filtered set is a single type, so the sum is
                // meaningful. Category/Paid To filters imply expenses-only even with no Type.
                const expenseOnly = type === "expense" || (!type && (!!category || !!paidTo));
                const label = type ? TYPE_FILTER_LABEL[type] ?? type : expenseOnly ? "Expense" : null;
                return label ? (
                  <p className="text-sm font-semibold">
                    {label} total: {inr(sumAmount)}
                  </p>
                ) : null;
              })()}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {!txns ? (
          <ListSkeleton />
        ) : txns.length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" />}>No transactions found.</EmptyState>
        ) : (
          <div className="divide-y divide-border">
            {txns.map((t) => (
              <TxnRow
                key={t.id}
                t={t}
                onDelete={deleteTxn}
                onRowClick={(tx) =>
                  tx.project_id ? router.push(`/projects/${tx.project_id}`) : router.push("/accounts")
                }
              />
            ))}
          </div>
        )}
      </Card>

      {pg && pg.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {pg.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!pg.hasPrevPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="!py-1.5 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-muted-foreground">
              Page {pg.page} of {pg.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={!pg.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="!py-1.5 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageInner />
    </Suspense>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
