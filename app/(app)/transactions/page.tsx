"use client";
import { useCallback, useEffect, useState } from "react";
import { Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Select, Input, Button, EmptyState } from "@/components/ui";
import { TxnRow } from "@/components/TxnRow";
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pg, setPg] = useState<Pagination | null>(null);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [type, projectId, category, account, from, to]);

  const load = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (type) qs.set("type", type);
    if (projectId) qs.set("project_id", projectId);
    if (category) qs.set("category", category);
    if (account) qs.set("account", account);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/transactions?${qs}`)
      .then((r) => r.json())
      .then((res) => {
        setTxns(res.data ?? []);
        setPg(res.pagination ?? null);
      });
  }, [type, projectId, category, account, from, to, page]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data));
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategories(j.data));
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data));
  }, []);

  const hasFilters = !!(type || projectId || category || account || from || to);
  function clearFilters() {
    setType("");
    setProjectId("");
    setCategory("");
    setAccount("");
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
          <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-auto">
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label="Site">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="!w-auto">
            <option value="">All Sites</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="!w-auto">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label="Account">
          <Select value={account} onChange={(e) => setAccount(e.target.value)} className="!w-auto">
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label="From">
          <Input type="date" max={to || todayISO()} value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto" />
        </Filter>
        <Filter label="To">
          <Input type="date" max={todayISO()} min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto" />
        </Filter>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-[42px] rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:bg-muted"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{pg ? `${pg.total} entries` : "—"}</span>
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
