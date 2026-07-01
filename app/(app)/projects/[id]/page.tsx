"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, ArrowDownToLine, Building2, AlertTriangle, Receipt, Pencil, Check, X, Trash2, Wallet } from "lucide-react";
import { Card, Label, Button, Input, Skeleton, EmptyState, CustomSelect, CustomDatePicker, Table, THead, TBody, Th, Td } from "@/components/ui";
import { useActions } from "@/components/ActionsProvider";
import { useUI } from "@/components/UIProvider";
import { inr, formatDate, TYPE_LABELS, profitStatus, PROFIT_LABEL, PROFIT_HINT, type ProfitLevel } from "@/lib/format";
import { TxnRow } from "@/components/TxnRow";
import PaidToPicker from "@/components/PaidToPicker";
import RaReceiptSheet, { ratesForReceipt, type RaReceipt } from "@/components/RaReceiptSheet";
import RaPaymentsSheet from "@/components/RaPaymentsSheet";
import VendorBillSheet, { type VendorBill } from "@/components/VendorBillSheet";
import VendorPaymentsSheet from "@/components/VendorPaymentsSheet";
import RojmelBook from "@/components/RojmelBook";
import { computeRa, DEFAULT_RA_RATES, type RaRates } from "@/lib/ra";

const STATUS_COLOR: Record<string, string> = { active: "green", on_hold: "amber", completed: "blue" };
const STATUS_LABEL: Record<string, string> = { active: "Active", on_hold: "On Hold", completed: "Completed" };
// Payment status shared by the RA-receipt & vendor-bill tabs.
const PAY_STATUS_LABEL: Record<string, string> = { pending: "Pending", partial: "Partially Paid", complete: "Complete" };
const PAY_STATUS_COLOR: Record<string, string> = { pending: "amber", partial: "blue", complete: "green" };

type TabKey = "transactions" | "books" | "rojmel" | "heads" | "ra" | "vendor";
type BookType = "bank" | "cash" | "partner";
type SiteHead = { id: number; name: string; spent: number; subheads: { id: number; name: string; spent: number }[] };
const PROFIT_STYLE: Record<ProfitLevel, string> = {
  profit: "bg-success/10 text-success",
  loss: "bg-danger/10 text-danger",
  even: "bg-muted text-muted-foreground",
};

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
  const [head, setHead] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pg, setPg] = useState<Pagination | null>(null);
  const [sumAmount, setSumAmount] = useState(0);

  // Sub-tabs on the site: the transaction ledger + site-scoped Heads / RA / Vendor Bills.
  const [tab, setTab] = useState<TabKey>("transactions");
  const [siteHeads, setSiteHeads] = useState<SiteHead[] | null>(null);
  // Heads tab drills down: null = the head list; a head id = that head's expense entries.
  const [selectedHead, setSelectedHead] = useState<number | null>(null);
  const [headTxns, setHeadTxns] = useState<any[] | null>(null);
  // Clicking a transaction / head entry jumps to the owning tab and highlights the exact row.
  const [billHighlight, setBillHighlight] = useState<number | null>(null);
  const [raHighlight, setRaHighlight] = useState<number | null>(null);
  // Heads-tab filters (Account / date range) — scope the head-wise spend.
  const [hAccount, setHAccount] = useState("");
  const [hFrom, setHFrom] = useState("");
  const [hTo, setHTo] = useState("");
  const [raRows, setRaRows] = useState<any[] | null>(null);
  const [vendorRows, setVendorRows] = useState<any[] | null>(null);
  const [bookRows, setBookRows] = useState<any[] | null>(null);
  const [bookType, setBookType] = useState<BookType>("bank");
  // Books-tab filters (client-side over the loaded site expense rows).
  const [bkAccount, setBkAccount] = useState("");
  const [bkFrom, setBkFrom] = useState("");
  const [bkTo, setBkTo] = useState("");
  const [bkParty, setBkParty] = useState("");
  const [bkHead, setBkHead] = useState("");
  const [bkType, setBkType] = useState("");
  // Receipt-of-RA tab filters (client-side over the site's RA receipts).
  const [raFrom, setRaFrom] = useState("");
  const [raTo, setRaTo] = useState("");
  const [raAccount, setRaAccount] = useState("");
  const [raStatus, setRaStatus] = useState("");
  // Vendor Bills tab filters (client-side over the site's vendor bills).
  const [vbFrom, setVbFrom] = useState("");
  const [vbTo, setVbTo] = useState("");
  const [vbStatus, setVbStatus] = useState("");
  const [vbPayType, setVbPayType] = useState("");
  const [vbVendor, setVbVendor] = useState("");
  const [raSheetOpen, setRaSheetOpen] = useState(false);
  // Per-site RA deduction rates (persisted on the site; fall back to defaults).
  const [siteRates, setSiteRates] = useState<RaRates>(DEFAULT_RA_RATES);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [raEditing, setRaEditing] = useState<RaReceipt | null>(null);
  const [raPaying, setRaPaying] = useState<RaReceipt | null>(null);
  const [vendorSheetOpen, setVendorSheetOpen] = useState(false);
  const [vendorEditing, setVendorEditing] = useState<VendorBill | null>(null);
  const [vendorPaying, setVendorPaying] = useState<VendorBill | null>(null);
  const loadHeads = useCallback(() => {
    const qs = new URLSearchParams({ project_id: String(id) });
    if (hAccount) qs.set("account_id", hAccount);
    if (hFrom) qs.set("from", hFrom);
    if (hTo) qs.set("to", hTo);
    fetch(`/api/categories?${qs}`).then((r) => r.json()).then((j) => setSiteHeads(j.data ?? []));
  }, [id, hAccount, hFrom, hTo]);
  const loadRa = useCallback(() => {
    fetch(`/api/ra-receipts`)
      .then((r) => r.json())
      .then((j) => setRaRows((j.data ?? []).filter((x: any) => String(x.project_id) === String(id))));
  }, [id]);
  const loadVendor = useCallback(() => {
    fetch(`/api/vendor-bills`)
      .then((r) => r.json())
      .then((j) => setVendorRows((j.data ?? []).filter((x: any) => String(x.project_id) === String(id))));
  }, [id]);
  // Books = this site's payment register (money spent on the site, across all accounts).
  const loadBooks = useCallback(() => {
    const qs = new URLSearchParams({ project_id: String(id), type: "expense", limit: "200" });
    fetch(`/api/transactions?${qs}`).then((r) => r.json()).then((res) => setBookRows(res.data ?? []));
  }, [id]);

  const loadSite = useCallback(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => setP(j.data))
      .catch(() => setNotFound(true));
  }, [id]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [type, head, category, account, paidTo, from, to]);

  const loadTxns = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page), project_id: String(id) });
    if (type) qs.set("type", type);
    if (head) qs.set("head", head);
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
  }, [id, type, head, category, account, paidTo, from, to, page]);

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
      // Refresh whichever sub-tab is open so its data stays current after a change.
      if (tab === "heads") loadHeads();
      if (tab === "ra") loadRa();
      if (tab === "vendor") loadVendor();
      if (tab === "books") loadBooks();
    };
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [loadSite, loadTxns, tab, loadHeads, loadRa, loadVendor, loadBooks]);

  // Heads reloads whenever its tab is open and its filters (loadHeads identity) change.
  useEffect(() => {
    if (tab === "heads") loadHeads();
  }, [tab, loadHeads]);

  // Lazy-load RA / Vendor / Books data the first time their tab is opened.
  useEffect(() => {
    if (tab === "ra" && raRows === null) loadRa();
    if (tab === "vendor" && vendorRows === null) loadVendor();
    if (tab === "books" && bookRows === null) loadBooks();
  }, [tab, raRows, vendorRows, bookRows, loadRa, loadVendor, loadBooks]);

  // When a head is drilled into, load its expense entries (this site + the Heads-tab
  // Account/date filters), so we can list each expense with its date, type of head & amount.
  useEffect(() => {
    if (tab !== "heads" || selectedHead == null || !siteHeads) return;
    const head = siteHeads.find((h) => h.id === selectedHead);
    if (!head) return;
    setHeadTxns(null);
    const qs = new URLSearchParams({ project_id: String(id), type: "expense", head: head.name, limit: "200" });
    if (hAccount) qs.set("account", hAccount);
    if (hFrom) qs.set("from", hFrom);
    if (hTo) qs.set("to", hTo);
    fetch(`/api/transactions?${qs}`).then((r) => r.json()).then((res) => setHeadTxns(res.data ?? []));
  }, [tab, selectedHead, siteHeads, id, hAccount, hFrom, hTo]);

  const hasFilters = !!(type || head || category || account || paidTo || from || to);
  function clearFilters() {
    setType("");
    setHead("");
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

  // Seed the rate panel from the site's saved rates once it loads (JSON column may arrive
  // as an object or a string depending on the driver).
  useEffect(() => {
    const raw: any = (p as any)?.ra_rates;
    if (!raw) return;
    const obj = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (obj) setSiteRates({ ...DEFAULT_RA_RATES, ...obj });
  }, [p]);

  async function saveRates() {
    setSavingRates(true);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ra_rates: siteRates }),
    });
    setSavingRates(false);
    if (!res.ok) return toast((await res.json()).message || "Could not save rates", "error");
    toast("Deduction rates saved for this site", "success");
    loadSite();
    loadRa();
  }

  async function deleteRa(r: RaReceipt & { paid?: number }) {
    const okToDelete = await confirm({
      title: "Delete RA receipt?",
      message:
        Number(r.paid) > 0
          ? `This bill and its ${inr(Number(r.paid))} of recorded payment(s) will be removed, and that amount reversed from the account(s) it credited.`
          : `The bill of ${inr(Number(r.amount))} will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!okToDelete) return;
    const res = await fetch(`/api/ra-receipts/${r.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).message || "Could not delete", "error");
    toast("RA receipt deleted", "success");
    loadRa();
    window.dispatchEvent(new CustomEvent("txn:created"));
  }

  async function deleteVendor(r: VendorBill) {
    const okToDelete = await confirm({
      title: "Delete vendor bill?",
      message:
        Number(r.paid) > 0
          ? `This bill and its ${inr(Number(r.paid))} of recorded payment(s) will be removed, and that amount reversed from the account/site it was paid from.`
          : `The bill of ${inr(Number(r.total_bill))} will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!okToDelete) return;
    const res = await fetch(`/api/vendor-bills/${r.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).message || "Could not delete", "error");
    toast("Vendor bill deleted", "success");
    loadVendor();
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

  // Profit = income earned − ALL money spent on the site (site funds + direct).
  const { profit, level: pLevel } = profitStatus(Number(p.income || 0), Number(p.spent || 0));
  const hasActivity = Number(p.income || 0) > 0 || Number(p.spent || 0) > 0;
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
            <p className="text-sm text-muted-foreground">Site Fund</p>
            <p className={`mt-1 text-3xl font-bold ${p.balance < 0 ? "text-danger" : "text-foreground"}`}>
              {inr(p.balance)}
            </p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-sm text-muted-foreground">Profit / Loss</p>
            <span
              title={PROFIT_HINT}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${PROFIT_STYLE[pLevel]}`}
            >
              {pLevel === "loss" && <AlertTriangle className="h-3.5 w-3.5" />}
              {PROFIT_LABEL[pLevel]}
              {hasActivity && ` · ${inr(Math.abs(profit))}`}
            </span>
            {hasActivity && (
              <p className="mt-1.5 text-[11px] font-medium text-muted-foreground" title="Revenue minus Total Spent">
                {inr(p.income)} (Rev) - {inr(p.spent)} (Spent)
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <Mini label="Funds Allocated" value={inr(p.received)} className="text-success" hint="Funds moved into this site from your accounts" />
          <Mini
            label="Revenue Earned"
            value={inr(p.income)}
            className="text-success"
            hint="Money earned from this site (sale, rent, etc.) deposited to an account"
          />
          <Mini
            label="Total Spent"
            value={inr(p.spent)}
            className="text-danger"
            hint="Total actual expenses (Site funds + Direct)"
          />
          <Mini
            label="Spent · Site funds"
            value={inr(p.spent_site)}
            className="text-danger"
            hint="Paid from the site’s allocated funds — lowers the balance"
          />
          <Mini
            label="Spent · Accounts + Cash + Partner"
            value={inr(p.spent_direct)}
            className="text-danger"
            hint="Paid straight from a bank/cash/partner account — tagged to this site"
          />
          <Mini label="Last Activity" value={p.last_txn_date ? formatDate(p.last_txn_date) : "—"} />
        </div>
      </Card>

      {/* Sub-tabs: this site's transactions, head-wise spend, RA receipts & vendor bills. */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {([
          ["transactions", "Transactions"],
          ["books", "Books"],
          ["rojmel", "Rojmel"],
          ["heads", "Heads"],
          ["ra", "Receipt of RA"],
          ["vendor", "Vendor Bills"],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "transactions" && (
      <>
      {/* Transactions (same filters as the Transactions page, locked to this site) */}
      <div className="flex flex-wrap items-end gap-3">
        <Filter label="Type">
          <CustomSelect
            value={type}
            onChange={(val) => setType(val)}
            onClear={() => setType("")}
            options={[
              { label: "All Types", value: "" },
              { label: "Transfer", value: "transfer" },
              { label: "Expense", value: "expense" },
              { label: "Revenue Earned", value: "income" },
              { label: "Partner Payout", value: "partner_withdrawal" },
            ]}
            placeholder="All Types"
            className="w-40"
          />
        </Filter>
        <Filter label="Head">
          <CustomSelect
            value={head}
            onChange={(val) => { setHead(val); setCategory(""); }}
            onClear={() => { setHead(""); setCategory(""); }}
            options={[{ label: "All Heads", value: "" }, ...categories.map((h) => ({ label: h.name, value: h.name }))]}
            placeholder="All Heads"
            className="w-40"
          />
        </Filter>
        <Filter label="Type of Head">
          <CustomSelect
            value={category}
            onChange={(val) => setCategory(val)}
            onClear={() => setCategory("")}
            options={[
              { label: "All Types", value: "" },
              ...(categories.find((h) => h.name === head)?.subheads ?? []).map((s) => ({ label: s.name, value: s.name })),
            ]}
            placeholder={head ? "All Types" : "Select a Head first"}
            disabled={!head}
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
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">{pg ? `${pg.total} entries` : "—"}</p>
          {pg &&
            pg.total > 0 &&
            (() => {
              // Single-type filter → show its total. Category/Paid To imply expenses-only.
              const expenseOnly = type === "expense" || (!type && (!!head || !!category || !!paidTo));
              const label = type ? (type === "income" ? "Revenue Earned" : TYPE_LABELS[type]) : expenseOnly ? "Expense" : null;
              return label ? (
                <p className="text-sm font-semibold">
                  {label} total: {inr(sumAmount)}
                </p>
              ) : null;
            })()}
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
                t={{ ...t, project_name: p.name }}
                onDelete={deleteTxn}
                hideSite
                onRowClick={(row) => {
                  // Jump to the tab that owns this transaction (and highlight the exact row).
                  if (row.bill_id) { setBillHighlight(row.bill_id); setTab("vendor"); }
                  else if (row.receipt_id) { setRaHighlight(row.receipt_id); setTab("ra"); }
                  else if (row.source_type === "cash") { setTab("rojmel"); }
                  else { setTab("books"); }
                }}
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
      </>
      )}

      {/* Books tab — this site's payment register, split by paying account type. */}
      {tab === "books" && (
        <div className="space-y-3">
          {/* Bank / Cashbook / Partner sub-tabs — filter payments by the paying account type. */}
          <div className="flex flex-wrap gap-2">
            {([
              ["bank", "Bank"],
              ["cash", "Cashbook"],
              ["partner", "Partner"],
            ] as [BookType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setBookType(key); setBkAccount(""); }}
                className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition ${
                  bookType === key
                    ? "border-primary bg-primary text-white"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {(() => {
            if (!bookRows) return <Card className="overflow-hidden"><ListSkeleton /></Card>;
            // Payments paid directly from an account of the selected type (direct site expenses).
            const typeRows = bookRows.filter((t) => t.source_type === bookType);
            // Filter option sources (from the type-scoped set, so they stay stable as you filter).
            const acctOpts = accounts.filter((a) => a.account_type === bookType);
            const partyOpts = [...new Set(typeRows.map((t) => t.paid_to).filter(Boolean))] as string[];
            const headOpts = [...new Set(typeRows.map((t) => t.category_head).filter(Boolean))] as string[];
            const typeHeadOpts = [
              ...new Set(typeRows.filter((t) => !bkHead || t.category_head === bkHead).map((t) => t.category).filter(Boolean)),
            ] as string[];
            const accLabel = bookType === "bank" ? "Bank account" : bookType === "cash" ? "Cash account" : "Partner account";
            const allAccLabel = bookType === "bank" ? "All bank accounts" : bookType === "cash" ? "All cash accounts" : "All partners";
            // Apply the filters.
            const rows = typeRows.filter(
              (t) =>
                (!bkAccount || String(t.source_account_id) === bkAccount) &&
                (!bkFrom || (t.txn_date && t.txn_date >= bkFrom)) &&
                (!bkTo || (t.txn_date && t.txn_date <= bkTo)) &&
                (!bkParty || t.paid_to === bkParty) &&
                (!bkHead || t.category_head === bkHead) &&
                (!bkType || t.category === bkType)
            );
            const hasFilters = bkAccount || bkFrom || bkTo || bkParty || bkHead || bkType;
            const clearAll = () => { setBkAccount(""); setBkFrom(""); setBkTo(""); setBkParty(""); setBkHead(""); setBkType(""); };
            return (
              <>
              {/* Filter bar — mirrors the Bank/Cashbook register filters, scoped to this site. */}
              <div className="flex flex-wrap items-end gap-3">
                <Filter label={accLabel}>
                  <CustomSelect
                    value={bkAccount}
                    onChange={setBkAccount}
                    onClear={() => setBkAccount("")}
                    options={[{ label: allAccLabel, value: "" }, ...acctOpts.map((a) => ({ label: a.name, value: String(a.id) }))]}
                    placeholder={allAccLabel}
                    className="w-44"
                  />
                </Filter>
                <Filter label="From">
                  <CustomDatePicker value={bkFrom} onChange={setBkFrom} onClear={() => setBkFrom("")} maxDate={bkTo || undefined} className="w-40" />
                </Filter>
                <Filter label="To">
                  <CustomDatePicker value={bkTo} onChange={setBkTo} onClear={() => setBkTo("")} minDate={bkFrom || undefined} className="w-40" align="right" />
                </Filter>
                <Filter label="Party">
                  <CustomSelect
                    value={bkParty}
                    onChange={setBkParty}
                    onClear={() => setBkParty("")}
                    options={[{ label: "All Parties", value: "" }, ...partyOpts.map((p) => ({ label: p, value: p }))]}
                    placeholder="All Parties"
                    className="w-40"
                  />
                </Filter>
                <Filter label="Head">
                  <CustomSelect
                    value={bkHead}
                    onChange={(v) => { setBkHead(v); setBkType(""); }}
                    onClear={() => { setBkHead(""); setBkType(""); }}
                    options={[{ label: "All Heads", value: "" }, ...headOpts.map((h) => ({ label: h, value: h }))]}
                    placeholder="All Heads"
                    className="w-44"
                  />
                </Filter>
                <Filter label="Type of Head">
                  <CustomSelect
                    value={bkType}
                    onChange={setBkType}
                    onClear={() => setBkType("")}
                    options={[{ label: "All Types", value: "" }, ...typeHeadOpts.map((c) => ({ label: c as string, value: c as string }))]}
                    placeholder={bkHead ? "All Types" : "Select a Head first"}
                    disabled={!bkHead}
                    className="w-44"
                  />
                </Filter>
                {hasFilters && (
                  <Button variant="ghost" onClick={clearAll} className="!py-1.5 text-sm text-muted-foreground">
                    Clear
                  </Button>
                )}
              </div>
              {rows.length === 0 ? (
                <Card>
                  <EmptyState icon={<Receipt className="h-6 w-6" />}>
                    {hasFilters ? "No payments match these filters." : `No ${bookType} payments for this site.`}
                  </EmptyState>
                </Card>
              ) : (
              <Card className="overflow-x-auto">
                <Table minWidth={900}>
                  <THead>
                    <Th>#</Th>
                    <Th>Date</Th>
                    <Th>Party Name</Th>
                    <Th>Particular / Bill Details</Th>
                    <Th>{bookType === "bank" ? "Bank" : bookType === "cash" ? "Cash Account" : "Partner"}</Th>
                    <Th>Head</Th>
                    <Th>Type of Head</Th>
                    <Th right>Net Payment</Th>
                  </THead>
                  <TBody>
                    {rows.map((t, i) => (
                      <tr key={t.id}>
                        <Td>{i + 1}</Td>
                        <Td>{t.txn_date ? formatDate(t.txn_date) : "—"}</Td>
                        <Td>{t.paid_to || "—"}</Td>
                        <Td className="max-w-[220px] truncate text-muted-foreground">{t.note || t.project_name || "—"}</Td>
                        <Td>{t.source_name || "—"}</Td>
                        <Td>{t.category_head || "—"}</Td>
                        <Td>{t.category || "—"}</Td>
                        <Td right className="font-medium text-danger">{inr(t.amount)}</Td>
                      </tr>
                    ))}
                  </TBody>
                  <tfoot className="border-t-2 border-border bg-muted/60 font-semibold">
                    <tr>
                      <td className="px-3 py-2.5" colSpan={7}>Total</td>
                      <Td right>{inr(rows.reduce((s, t) => s + Number(t.amount), 0))}</Td>
                    </tr>
                  </tfoot>
                </Table>
              </Card>
              )}
              </>
            );
          })()}
        </div>
      )}

      {/* Rojmel tab — the cash daybook (its own cash-account picker). */}
      {tab === "rojmel" && <RojmelBook />}

      {/* Heads tab — this site's spend broken down by Head / Type of Head. */}
      {tab === "heads" && (
        <div className="space-y-4">
          {/* Heads filters — scope the head-wise spend by paying account + date range. */}
          <div className="flex flex-wrap items-end gap-3">
            <Filter label="Account">
              <CustomSelect
                value={hAccount}
                onChange={setHAccount}
                onClear={() => setHAccount("")}
                options={[{ label: "All Accounts", value: "" }, ...accounts.map((a) => ({ label: a.name, value: String(a.id) }))]}
                placeholder="All Accounts"
                className="w-44"
              />
            </Filter>
            <Filter label="From">
              <CustomDatePicker value={hFrom} onChange={setHFrom} onClear={() => setHFrom("")} maxDate={hTo || undefined} className="w-40" />
            </Filter>
            <Filter label="To">
              <CustomDatePicker value={hTo} onChange={setHTo} onClear={() => setHTo("")} minDate={hFrom || undefined} className="w-40" align="right" />
            </Filter>
            {(hAccount || hFrom || hTo) && (
              <button
                onClick={() => { setHAccount(""); setHFrom(""); setHTo(""); }}
                className="h-[42px] rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:bg-muted"
              >
                Clear
              </button>
            )}
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Total spent</p>
              <p className="text-sm font-semibold">{inr((siteHeads ?? []).reduce((s, h) => s + h.spent, 0))}</p>
            </div>
          </div>

          {!siteHeads ? (
          <Card className="overflow-hidden"><ListSkeleton /></Card>
        ) : siteHeads.filter((h) => h.spent > 0).length === 0 ? (
          <Card><EmptyState icon={<Receipt className="h-6 w-6" />}>No spend for the selected filters.</EmptyState></Card>
        ) : selectedHead != null ? (
          // Drill-down: the selected head's expense entries (date · type of head · amount).
          (() => {
            const h = siteHeads.find((x) => x.id === selectedHead);
            if (!h) { setSelectedHead(null); return null; }
            return (
              <Card className="overflow-x-auto !p-0">
                <div className="flex items-center justify-between gap-2 border-b border-border p-3">
                  <button
                    onClick={() => setSelectedHead(null)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-primary transition hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back to Heads
                  </button>
                  <span className="flex items-center gap-3 pr-2">
                    <span className="font-semibold text-foreground">{h.name}</span>
                    <span className="text-sm font-semibold text-foreground">{inr(h.spent)}</span>
                  </span>
                </div>
                {!headTxns ? (
                  <ListSkeleton />
                ) : headTxns.length === 0 ? (
                  <EmptyState icon={<Receipt className="h-6 w-6" />}>No expenses under this head.</EmptyState>
                ) : (
                  <Table minWidth={640}>
                    <THead>
                      <Th>Date</Th>
                      <Th>Type of Head</Th>
                      <Th>Paid To</Th>
                      <Th>Paid From</Th>
                      <Th right>Amount</Th>
                    </THead>
                    <TBody>
                      {headTxns.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => {
                            if (!t.bill_id) return;
                            setBillHighlight(t.bill_id);
                            setTab("vendor");
                          }}
                          className={`transition-colors ${t.bill_id ? "cursor-pointer hover:bg-muted/40" : ""}`}
                          title={t.bill_id ? "Open this bill in Vendor Bills" : "Not linked to a vendor bill"}
                        >
                          <Td>{t.txn_date ? formatDate(t.txn_date) : "—"}</Td>
                          <Td>{t.category || "—"}</Td>
                          <Td>{t.paid_to || "—"}</Td>
                          <Td>{t.source_name || "Site funds"}</Td>
                          <Td right className="font-medium text-danger">{inr(t.amount)}</Td>
                        </tr>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Card>
            );
          })()
        ) : (
          <Card className="overflow-x-auto !p-0">
            <Table>
              <THead>
                <Th>Head</Th>
                <Th right>Spent</Th>
              </THead>
              <TBody>
                {siteHeads
                  .filter((h) => h.spent > 0)
                  .sort((a, b) => b.spent - a.spent)
                  .map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => setSelectedHead(h.id)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <Td>
                        <span className="flex items-center gap-2 font-semibold text-foreground">
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {h.name}
                        </span>
                      </Td>
                      <Td right className="font-semibold">{inr(h.spent)}</Td>
                    </tr>
                  ))}
              </TBody>
            </Table>
          </Card>
          )}
        </div>
      )}

      {/* Receipt of RA tab — RA receipts tagged to this site. */}
      {tab === "ra" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Receipt of RA</h2>
            <Button onClick={() => setRaSheetOpen(true)} className="!py-1.5 text-sm">
              <Plus className="h-4 w-4" /> Add Receipt of RA — {p.name}
            </Button>
          </div>

          {/* Per-site deduction rates — persisted on the site and used for its RA figures. */}
          <Card className="!p-0">
            <button
              onClick={() => setRatesOpen((o) => !o)}
              className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium"
              aria-expanded={ratesOpen}
            >
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition ${ratesOpen ? "rotate-90" : ""}`} />
              Deduction Rates (for this site)
              <span className="ml-auto text-xs text-muted-foreground">
                GST {siteRates.gst}% · TDS {siteRates.tds}% · SD {siteRates.sd}%
              </span>
            </button>
            {ratesOpen && (
              <div className="border-t border-border p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {([
                    ["gst", "GST %"],
                    ["tds", "TDS %"],
                    ["tdsGst", "TDS on GST %"],
                    ["sd", "SD %"],
                    ["cess", "Workman Cess %"],
                    ["subletGst", "Sub-let GST %"],
                  ] as [keyof RaRates, string][]).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
                      <Input
                        inputMode="decimal"
                        value={String(siteRates[key])}
                        onChange={(e) =>
                          setSiteRates((r) => ({ ...r, [key]: e.target.value === "" ? 0 : Number(e.target.value) }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button onClick={saveRates} loading={savingRates} className="!py-1.5 text-sm">
                    <Check className="h-4 w-4" /> Save for this site
                  </Button>
                  <Button variant="outline" onClick={() => setSiteRates(DEFAULT_RA_RATES)} className="!py-1.5 text-sm">
                    Reset to defaults
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Changing these rates only affects <span className="font-medium">new</span> receipts. Existing rows keep the
                  rate they were saved with — a
                  <span className="mx-1 inline-block rounded bg-warning/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold leading-none text-warning">
                    1.2%
                  </span>
                  tag on a value means that row was calculated at that rate (different from the rate above).
                </p>
              </div>
            )}
          </Card>
          {/* Filter bar — mirrors the Receipt of RA register filters, scoped to this site. */}
          <div className="flex flex-wrap items-end gap-3">
            <Filter label="From">
              <CustomDatePicker value={raFrom} onChange={setRaFrom} onClear={() => setRaFrom("")} maxDate={raTo || undefined} className="w-40" />
            </Filter>
            <Filter label="To">
              <CustomDatePicker value={raTo} onChange={setRaTo} onClear={() => setRaTo("")} minDate={raFrom || undefined} className="w-40" align="right" />
            </Filter>
            <Filter label="Received In">
              <CustomSelect
                value={raAccount}
                onChange={setRaAccount}
                onClear={() => setRaAccount("")}
                options={[{ label: "All Accounts", value: "" }, ...accounts.map((a) => ({ label: a.name, value: String(a.id) }))]}
                placeholder="All Accounts"
                className="w-44"
              />
            </Filter>
            <Filter label="Status">
              <CustomSelect
                value={raStatus}
                onChange={setRaStatus}
                onClear={() => setRaStatus("")}
                options={[
                  { label: "All Statuses", value: "" },
                  { label: "Pending", value: "pending" },
                  { label: "Partially Paid", value: "partial" },
                  { label: "Complete", value: "complete" },
                ]}
                placeholder="All Statuses"
                className="w-40"
              />
            </Filter>
            {(raFrom || raTo || raAccount || raStatus) && (
              <Button variant="ghost" onClick={() => { setRaFrom(""); setRaTo(""); setRaAccount(""); setRaStatus(""); }} className="!py-1.5 text-sm text-muted-foreground">
                Clear
              </Button>
            )}
          </div>
          {raHighlight != null && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
              <span className="text-foreground">
                {(() => {
                  const r = (raRows ?? []).find((x) => x.id === raHighlight);
                  return r ? <>Showing the receipt for <strong>{r.paid_to || "—"}</strong></> : <>Showing the selected receipt</>;
                })()}
              </span>
              <button onClick={() => setRaHighlight(null)} className="inline-flex items-center gap-1 text-primary hover:underline">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          )}
          {(() => {
          const raHasFilters = !!(raFrom || raTo || raAccount || raStatus);
          const raFiltered = (raRows ?? []).filter(
            (r) =>
              (!raFrom || (r.txn_date && r.txn_date >= raFrom)) &&
              (!raTo || (r.txn_date && r.txn_date <= raTo)) &&
              (!raAccount || String(r.account_id) === raAccount) &&
              (!raStatus || r.status === raStatus)
          );
          return (
          <Card className="overflow-x-auto">
          {!raRows ? (
            <ListSkeleton />
          ) : raFiltered.length === 0 ? (
            <EmptyState icon={<Receipt className="h-6 w-6" />}>
              {raHasFilters ? "No RA receipts match these filters." : "No RA receipts for this site."}
            </EmptyState>
          ) : (
            <Table minWidth={1900}>
              <THead>
                <Th>Date</Th>
                <Th>Received From</Th>
                <Th>Received In</Th>
                <Th>Status</Th>
                <Th right>Amount</Th>
                <Th right>GST @ {siteRates.gst}%</Th>
                <Th right>Total Bill</Th>
                <Th right>TDS @ {siteRates.tds}%</Th>
                <Th right>TDS on GST @ {siteRates.tdsGst}%</Th>
                <Th right>SD @ {siteRates.sd}%</Th>
                <Th right>Workman Cess @ {siteRates.cess}%</Th>
                <Th right>Withheld Amt</Th>
                <Th right>Royalty</Th>
                <Th right>Total Deduction</Th>
                <Th right>Cheque Amt</Th>
                <Th right>Agency Charge</Th>
                <Th right>Net Receivable</Th>
                <Th right>Sub Let Bill</Th>
                <Th right>Sub-GST @ {siteRates.subletGst}%</Th>
                <Th right>Received</Th>
                <Th right>Actions</Th>
              </THead>
              <TBody>
                {raFiltered.map((r) => {
                  // This receipt's own saved rates win over the site default (e.g. a one-off 1.5% TDS).
                  // Changing the site panel never re-rates a saved row — it only relabels the columns,
                  // and each cell shows an "@x%" tag when the row's rate differs from the site rate.
                  const rowRates = ratesForReceipt(r.ra_rates, siteRates);
                  const c = computeRa(r, rowRates);
                  const hl = raHighlight != null && r.id === raHighlight;
                  return (
                    <tr key={r.id} className={hl ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}>
                      <Td>{r.txn_date ? formatDate(r.txn_date) : "—"}</Td>
                      <Td>{r.paid_to || "—"}</Td>
                      <Td>{r.account_name || "—"}</Td>
                      <Td><Label color={PAY_STATUS_COLOR[r.status]}>{PAY_STATUS_LABEL[r.status] || r.status}</Label></Td>
                      <Td right>{inr(r.amount)}</Td>
                      <Td right>{inr(c.gst)}<RateTag row={rowRates.gst} site={siteRates.gst} /></Td>
                      <Td right>{inr(c.total_bill)}</Td>
                      <Td right>{inr(c.tds)}<RateTag row={rowRates.tds} site={siteRates.tds} /></Td>
                      <Td right>{inr(c.tds_gst)}<RateTag row={rowRates.tdsGst} site={siteRates.tdsGst} /></Td>
                      <Td right>{inr(c.sd)}<RateTag row={rowRates.sd} site={siteRates.sd} /></Td>
                      <Td right>{inr(c.cess)}<RateTag row={rowRates.cess} site={siteRates.cess} /></Td>
                      <Td right>{inr(Number(r.withheld_amt) || 0)}</Td>
                      <Td right>{inr(Number(r.royalty) || 0)}</Td>
                      <Td right>{inr(c.total_deduction)}</Td>
                      <Td right>{inr(c.cheque_amt)}</Td>
                      <Td right>{inr(Number(r.agency_charge) || 0)}</Td>
                      <Td right className="font-semibold">{inr(c.net_receivable)}</Td>
                      <Td right>{inr(c.sub_let_bill)}</Td>
                      <Td right>{inr(c.sub_gst)}<RateTag row={rowRates.subletGst} site={siteRates.subletGst} /></Td>
                      <Td right className="text-success">{inr(r.paid)}</Td>
                      <Td right>
                        <span className="flex items-center justify-end gap-1">
                          <button onClick={() => setRaPaying(r)} title="Payments" className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                            <Wallet className="h-4 w-4" />
                          </button>
                          <button onClick={() => setRaEditing(r)} title="Edit" className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteRa(r)} title="Delete" className="rounded-lg p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          )}
          </Card>
          );
          })()}
        </div>
      )}

      {/* Vendor Bills tab — bills owed for this site. */}
      {tab === "vendor" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Vendor Bills</h2>
            <Button onClick={() => setVendorSheetOpen(true)} className="!py-1.5 text-sm">
              <Plus className="h-4 w-4" /> Add Vendor Bill — {p.name}
            </Button>
          </div>
          {/* Filter bar — mirrors the Vendor Bills register filters, scoped to this site. */}
          <div className="flex flex-wrap items-end gap-3">
            <Filter label="From">
              <CustomDatePicker value={vbFrom} onChange={setVbFrom} onClear={() => setVbFrom("")} maxDate={vbTo || undefined} className="w-40" />
            </Filter>
            <Filter label="To">
              <CustomDatePicker value={vbTo} onChange={setVbTo} onClear={() => setVbTo("")} minDate={vbFrom || undefined} className="w-40" align="right" />
            </Filter>
            <Filter label="Status">
              <CustomSelect
                value={vbStatus}
                onChange={setVbStatus}
                onClear={() => setVbStatus("")}
                options={[
                  { label: "All Statuses", value: "" },
                  { label: "Pending", value: "pending" },
                  { label: "Partially Paid", value: "partial" },
                  { label: "Complete", value: "complete" },
                ]}
                placeholder="All Statuses"
                className="w-40"
              />
            </Filter>
            <Filter label="Payment Type">
              <CustomSelect
                value={vbPayType}
                onChange={setVbPayType}
                onClear={() => setVbPayType("")}
                options={[
                  { label: "All Types", value: "" },
                  { label: "Normal", value: "normal" },
                  { label: "Advance", value: "advance" },
                ]}
                placeholder="All Types"
                className="w-40"
              />
            </Filter>
            <Filter label="Vendor">
              <Input value={vbVendor} onChange={(e) => setVbVendor(e.target.value)} placeholder="Search vendor..." className="w-44" />
            </Filter>
            {(vbFrom || vbTo || vbStatus || vbPayType || vbVendor) && (
              <Button variant="ghost" onClick={() => { setVbFrom(""); setVbTo(""); setVbStatus(""); setVbPayType(""); setVbVendor(""); }} className="!py-1.5 text-sm text-muted-foreground">
                Clear
              </Button>
            )}
          </div>
          {(() => {
          const vbHasFilters = !!(vbFrom || vbTo || vbStatus || vbPayType || vbVendor);
          const vendorFiltered = (vendorRows ?? []).filter(
            (r) =>
              (!vbFrom || (r.txn_date && r.txn_date >= vbFrom)) &&
              (!vbTo || (r.txn_date && r.txn_date <= vbTo)) &&
              (!vbStatus || r.status === vbStatus) &&
              (!vbPayType || r.payment_type === vbPayType) &&
              (!vbVendor || (r.paid_to || "").toLowerCase().includes(vbVendor.toLowerCase()))
          );
          return (
          <Card className="overflow-x-auto">
          {billHighlight != null && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
              <span className="text-foreground">
                {(() => {
                  const b = (vendorRows ?? []).find((x) => x.id === billHighlight);
                  return b ? (
                    <>Showing the bill for <strong>{b.paid_to || "—"}</strong> · <strong>{b.category_head || "—"}</strong></>
                  ) : (
                    <>Showing the selected bill</>
                  );
                })()}
              </span>
              <button onClick={() => setBillHighlight(null)} className="inline-flex items-center gap-1 text-primary hover:underline">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          )}
          {!vendorRows ? (
            <ListSkeleton />
          ) : vendorFiltered.length === 0 ? (
            <EmptyState icon={<Receipt className="h-6 w-6" />}>
              {vbHasFilters ? "No vendor bills match these filters." : "No vendor bills for this site."}
            </EmptyState>
          ) : (
            <Table minWidth={920}>
              <THead>
                <Th>Date</Th>
                <Th>Vendor</Th>
                <Th>Head</Th>
                <Th right>Amount</Th>
                <Th right>GST</Th>
                <Th right>Total Bill</Th>
                <Th right>Advance</Th>
                <Th right>Paid</Th>
                <Th right>Remaining</Th>
                <Th>Status</Th>
                <Th right>Actions</Th>
              </THead>
              <TBody>
                {vendorFiltered.map((r) => {
                  const remaining = Math.max(Number(r.total_bill) - Number(r.paid), 0);
                  const highlighted = billHighlight != null && r.id === billHighlight;
                  return (
                    <tr key={r.id} className={highlighted ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}>
                      <Td>{r.txn_date ? formatDate(r.txn_date) : "—"}</Td>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          {r.paid_to || "—"}
                          {r.payment_type === "advance" && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                              Advance
                            </span>
                          )}
                        </span>
                      </Td>
                      <Td>{r.category_head || "—"}</Td>
                      <Td right>{inr(Number(r.amount) || 0)}</Td>
                      <Td right>
                        {inr(Number(r.gst) || 0)}
                        {Number(r.amount) > 0 && Number(r.gst) > 0 && (
                          <span className="ml-1 align-middle text-[10px] text-muted-foreground">
                            @ {Math.round((Number(r.gst) / Number(r.amount)) * 10000) / 100}%
                          </span>
                        )}
                      </Td>
                      <Td right className="font-semibold">{inr(r.total_bill)}</Td>
                      <Td right>
                        {r.payment_type === "advance" && Number(r.advance) > 0 ? (
                          <button
                            onClick={() => setVendorPaying(r)}
                            title="View installments"
                            className="font-medium text-warning underline-offset-2 hover:underline"
                          >
                            {inr(Number(r.advance))}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td right className="text-success">
                        <button
                          onClick={() => setVendorPaying(r)}
                          title="View installments"
                          className="underline-offset-2 hover:underline"
                        >
                          {inr(r.paid)}
                          {Number(r.payment_count) > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">({r.payment_count})</span>
                          )}
                        </button>
                      </Td>
                      <Td right className={remaining > 0 ? "font-semibold text-danger" : ""}>{inr(remaining)}</Td>
                      <Td><Label color={PAY_STATUS_COLOR[r.status]}>{PAY_STATUS_LABEL[r.status] || r.status}</Label></Td>
                      <Td right>
                        <span className="flex items-center justify-end gap-1">
                          <button onClick={() => setVendorPaying(r)} title="Payments" className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                            <Wallet className="h-4 w-4" />
                          </button>
                          <button onClick={() => setVendorEditing(r)} title="Edit" className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteVendor(r)} title="Delete" className="rounded-lg p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          )}
          </Card>
          );
          })()}
        </div>
      )}

      {/* Add / edit an RA receipt for this site (auto-selects the site on create). */}
      <RaReceiptSheet
        open={raSheetOpen || raEditing != null}
        receipt={raEditing}
        rates={siteRates}
        defaultProjectId={Number(id)}
        onClose={() => { setRaSheetOpen(false); setRaEditing(null); }}
        onSaved={() => {
          setRaSheetOpen(false);
          setRaEditing(null);
          loadRa();
          window.dispatchEvent(new CustomEvent("txn:created"));
        }}
      />
      <RaPaymentsSheet
        open={raPaying != null}
        receipt={raPaying}
        netReceivable={Number(raPaying?.net_receivable) || 0}
        onClose={() => setRaPaying(null)}
        onChanged={() => {
          loadRa();
          window.dispatchEvent(new CustomEvent("txn:created"));
        }}
      />

      {/* Add / edit a vendor bill for this site (auto-selects + locks the site on create). */}
      <VendorBillSheet
        open={vendorSheetOpen || vendorEditing != null}
        bill={vendorEditing}
        defaultProjectId={Number(id)}
        onClose={() => { setVendorSheetOpen(false); setVendorEditing(null); }}
        onSaved={() => {
          setVendorSheetOpen(false);
          setVendorEditing(null);
          loadVendor();
          window.dispatchEvent(new CustomEvent("txn:created"));
        }}
      />
      <VendorPaymentsSheet
        open={vendorPaying != null}
        bill={vendorPaying}
        totalBill={Number(vendorPaying?.total_bill) || 0}
        onClose={() => setVendorPaying(null)}
        onChanged={() => {
          loadVendor();
          window.dispatchEvent(new CustomEvent("txn:created"));
        }}
      />
    </div>
  );
}

// An amber pill shown under a rate-driven cell when the row was booked at a different rate than
// the site's current one — the row keeps its own amount; the pill (+ tooltip) makes clear which
// rate produced it, so changing the site rate never silently misrepresents an old row.
function RateTag({ row, site }: { row: number; site: number }) {
  if (row === site) return null;
  return (
    <span
      title={`This row was calculated at ${row}% (the site now uses ${site}%)`}
      className="ml-1 inline-block whitespace-nowrap rounded bg-warning/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold leading-none text-warning"
    >
      {row}%
    </span>
  );
}

function Mini({
  label,
  value,
  className = "",
  hint,
}: {
  label: string;
  value: string;
  className?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground" title={hint}>
        {label}
      </p>
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
