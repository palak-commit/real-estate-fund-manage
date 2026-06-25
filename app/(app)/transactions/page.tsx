"use client";
import { useCallback, useEffect, useState } from "react";
import { Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CustomSelect, CustomDatePicker, Button, EmptyState } from "@/components/ui";
import { TxnRow } from "@/components/TxnRow";
import PaidToPicker from "@/components/PaidToPicker";
import { useUI } from "@/components/UIProvider";
import { TYPE_LABELS, inr, todayISO } from "@/lib/format";

type Project = { id: number; name: string };
type Account = { id: number; name: string; account_type: string };
type Category = { id: number; name: string };
type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
const PAGE_SIZE = 15;

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

export default function HistoryPage() {
  const { toast, confirm } = useUI();
  const [txns, setTxns] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pg, setPg] = useState<Pagination | null>(null);
  const [sumAmount, setSumAmount] = useState(0);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [type, projectId, category, account, paidTo, from, to]);

  const load = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (type) qs.set("type", type);
    if (projectId) qs.set("project_id", projectId);
    if (category) qs.set("category", category);
    if (account) qs.set("account", account);
    if (paidTo) qs.set("paid_to", paidTo);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/transactions?${qs}`)
      .then((r) => r.json())
      .then((res) => {
        setTxns(res.data ?? []);
        setPg(res.pagination ?? null);
        setSumAmount(res.summary?.amount ?? 0);
      });
  }, [type, projectId, category, account, paidTo, from, to, page]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data));
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategories(j.data));
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data));
  }, []);

  const hasFilters = !!(type || projectId || category || account || paidTo || from || to);
  function clearFilters() {
    setType("");
    setProjectId("");
    setCategory("");
    setAccount("");
    setPaidTo("");
    setFrom("");
    setTo("");
  }

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
            options={[
              { label: "All Types", value: "" },
              ...Object.entries(TYPE_LABELS)
                .filter(([k]) => k !== "partner_contribution")
                .map(([k, v]) => ({ label: v, value: k }))
            ]}
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
            value={category}
            onChange={(val) => setCategory(val)}
            onClear={() => setCategory("")}
            options={[
              { label: "All Categories", value: "" },
              ...categories.map((c) => ({ label: c.name, value: c.name }))
            ]}
            placeholder="All Categories"
            className="w-40"
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
            <PaidToPicker value={paidTo} onChange={setPaidTo} placeholder="All Payees" />
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
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">{pg ? `${pg.total} entries` : "—"}</p>
          {type && pg && pg.total > 0 && (
            <p className="text-sm font-semibold">
              {TYPE_LABELS[type]} total: {inr(sumAmount)}
            </p>
          )}
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
              <TxnRow key={t.id} t={t} onDelete={deleteTxn} />
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

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
