"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, ArrowDownToLine, Building2, AlertTriangle, Receipt, Pencil, Check, X } from "lucide-react";
import { Card, Label, Button, Input, Skeleton, EmptyState, CustomSelect, CustomDatePicker } from "@/components/ui";
import { useActions } from "@/components/ActionsProvider";
import { useUI } from "@/components/UIProvider";
import { inr, formatDate, TYPE_LABELS, siteStatus, LEVEL_LABEL, type SiteLevel } from "@/lib/format";
import { TxnRow } from "@/components/TxnRow";
import PaidToPicker from "@/components/PaidToPicker";

const STATUS_COLOR: Record<string, string> = { active: "green", on_hold: "amber", completed: "blue" };
const STATUS_LABEL: Record<string, string> = { active: "Active", on_hold: "On Hold", completed: "Completed" };
const LEVEL_STYLE: Record<SiteLevel, string> = {
  ok: "bg-success/10 text-success",
  low: "bg-warning/10 text-warning",
  critical: "bg-danger/10 text-danger",
  none: "bg-muted text-muted-foreground",
};

type Account = { id: number; name: string };
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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { recordExpense, allocateFunds } = useActions();
  const { toast, confirm } = useUI();
  const [p, setP] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", status: "active" });

  // Transactions list (same filters as the Transactions page, locked to this site)
  const [txns, setTxns] = useState<any[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pg, setPg] = useState<Pagination | null>(null);
  const [sumAmount, setSumAmount] = useState(0);

  const loadSite = useCallback(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => setP(j.data))
      .catch(() => setNotFound(true));
  }, [id]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [type, category, account, paidTo, from, to]);

  const loadTxns = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page), project_id: String(id) });
    if (type) qs.set("type", type);
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
  }, [id, type, category, account, paidTo, from, to, page]);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategories(j.data));
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data));
  }, []);

  useEffect(() => {
    loadSite();
    loadTxns();
    const h = () => {
      loadSite();
      loadTxns();
    };
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [loadSite, loadTxns]);

  const hasFilters = !!(type || category || account || paidTo || from || to);
  function clearFilters() {
    setType("");
    setCategory("");
    setAccount("");
    setPaidTo("");
    setFrom("");
    setTo("");
  }

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

  function startEdit() {
    setEditForm({ name: p.name, status: p.status });
    setEditing(true);
  }

  async function saveSite() {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      toast((await res.json()).message || "Could not update site", "error");
      return;
    }
    toast("Site updated", "success");
    setEditing(false);
    loadSite();
  }

  if (notFound) return <p className="text-muted-foreground">Site not found.</p>;
  if (!p)
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Card className="overflow-hidden">
          <ListSkeleton />
        </Card>
      </div>
    );

  const { runway, level } = siteStatus(p.balance, Number(p.spent14 || 0), Number(p.received || 0));
  const rangeStart = pg && pg.total > 0 ? (pg.page - 1) * pg.limit + 1 : 0;
  const rangeEnd = pg ? Math.min(pg.page * pg.limit, pg.total) : 0;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4" /> Sites
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <Input
              autoFocus
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="!w-56 !text-lg !font-semibold"
            />
            <div className="w-40">
              <CustomSelect
                value={editForm.status}
                onChange={(val) => setEditForm({ ...editForm, status: val })}
                options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ label: v, value: k }))}
              />
            </div>
            <div className="ml-auto flex gap-2">
              <Button onClick={saveSite}>
                <Check className="h-4 w-4" /> Save
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Building2 className="h-6 w-6 text-muted-foreground" /> {p.name}
            </h1>
            <Label color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status]}</Label>
            <button
              onClick={startEdit}
              aria-label="Edit site"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => allocateFunds(Number(id))}>
                <ArrowDownToLine className="h-4 w-4" /> Add Site Fund
              </Button>
              <Button onClick={() => recordExpense(Number(id))}>
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
            </div>
          </>
        )}
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

      {/* Transactions (same filters as the Transactions page, locked to this site) */}
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
                .map(([k, v]) => ({ label: v, value: k })),
            ]}
            placeholder="All Types"
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
              ...categories.map((c) => ({ label: c.name, value: c.name })),
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
              ...accounts.map((a) => ({ label: a.name, value: String(a.id) })),
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
              <TxnRow key={t.id} t={{ ...t, project_name: p.name }} onDelete={deleteTxn} />
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
              onClick={() => setPage((pp) => Math.max(1, pp - 1))}
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
              onClick={() => setPage((pp) => pp + 1)}
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

function Mini({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-semibold ${className}`}>{value}</p>
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
