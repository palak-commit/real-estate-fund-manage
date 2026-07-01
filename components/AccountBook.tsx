"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, Info, Download, FileText } from "lucide-react";
import Link from "next/link";
import { Card, Button, CustomSelect, CustomDatePicker, EmptyState, Table, THead, TBody, Th } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { downloadPdf } from "@/lib/pdf";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Row = {
  id: number;
  txn_date: string;
  type: string;
  note: string | null;
  paid_to: string | null;
  source_name: string | null;
  dest_name: string | null;
  project_id: number | null;
  project_name: string | null;
  category: string | null;
  category_head: string | null;
  debit: number;
  credit: number;
  balance: number;
};
type Book = {
  account: Account | null; // null when showing all accounts of a type
  rows: Row[];
  summary: { opening: number; totalIn: number; totalOut: number; closing: number };
};

// Bank / Cashbook are PAYMENT registers (the Excel "BANK" / "CASHBOOK" sheets): the
// expenses paid out of the selected account, categorised by Head / Sub-Head, with a
// Net Payment total. (Money coming IN is shown on the Dashboard / account ledger.)
export default function AccountBook({
  accountType,
  title,
}: {
  accountType: "bank" | "cash" | "partner";
  title: string;
}) {
  const isBank = accountType === "bank";
  // Noun used in picker labels / empty state ("Bank account", "All cash accounts", …).
  const typeNoun = accountType === "bank" ? "Bank" : accountType === "cash" ? "Cash" : "Partner";
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fParty, setFParty] = useState("");
  const [fSite, setFSite] = useState("");
  const [fHead, setFHead] = useState("");
  const [fSub, setFSub] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  // Master lists for the filter dropdowns — the full set of sites, heads/sub-heads and
  // payees, so every option is selectable regardless of what the loaded account has spent on.
  const [sites, setSites] = useState<string[]>([]);
  const [heads, setHeads] = useState<{ name: string; subheads: { name: string }[] }[]>([]);
  const [parties, setParties] = useState<string[]>([]);

  // Reload the account list (and their balances) on mount and whenever a transaction is
  // created elsewhere — e.g. adding a site fund out of a bank/cash account — so the balances
  // shown in the picker stay current. Default selection stays empty → opens on "all".
  const loadAccounts = useCallback(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((j) => setAccounts((j.data as Account[]).filter((a) => a.account_type === accountType)));
  }, [accountType]);

  useEffect(() => {
    loadAccounts();
    const h = () => loadAccounts();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [loadAccounts]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => setSites((j.data as any[]).map((p) => p.name)));
    fetch("/api/categories").then((r) => r.json()).then((j) => setHeads(j.data ?? []));
    fetch("/api/payees").then((r) => r.json()).then((j) => setParties(j.data ?? []));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    // A specific account → that account's book; none selected → all accounts of this type.
    const qs = new URLSearchParams(accountId ? { account_id: accountId } : { account_type: accountType });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/accountbook?${qs}`)
      .then((r) => r.json())
      .then((j) => setBook(j.data ?? null))
      .finally(() => setLoading(false));
  }, [accountId, accountType, from, to]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  // Money OUT of this account: expenses paid from it + site-fund allocations (a transfer
  // out of the account into a site — credit, with no destination account).
  const payments = useMemo(
    () =>
      (book?.rows ?? []).filter(
        (r) => r.type === "expense" || (r.type === "transfer" && Number(r.credit) > 0 && !r.dest_name)
      ),
    [book]
  );

  // Filter options come from the master lists (all sites / heads / payees), not just the
  // payments currently loaded — so any value can be picked even on a fresh account.
  const dedupeSort = (vals: string[]) =>
    Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const partyOptions = useMemo(() => dedupeSort(parties), [parties]);
  const siteOptions = useMemo(() => dedupeSort(sites), [sites]);
  const headOptions = useMemo(() => dedupeSort(heads.map((h) => h.name)), [heads]);
  // Types of Head cascade from the chosen Head (or all sub-heads when no head is selected).
  const subOptions = useMemo(() => {
    const subs = (fHead ? heads.find((h) => h.name === fHead)?.subheads ?? [] : heads.flatMap((h) => h.subheads));
    return dedupeSort(subs.map((s) => s.name));
  }, [heads, fHead]);

  const filtered = useMemo(
    () =>
      payments.filter(
        (r) =>
          (!fParty || r.paid_to === fParty) &&
          (!fSite || r.project_name === fSite) &&
          (!fHead || r.category_head === fHead) &&
          (!fSub || r.category === fSub)
      ),
    [payments, fParty, fSite, fHead, fSub]
  );
  const netTotal = useMemo(() => filtered.reduce((s, r) => s + Number(r.credit), 0), [filtered]);

  // "Clear" resets every filter, including the selected account.
  const hasFilters = !!(accountId || from || to || fParty || fSite || fHead || fSub);
  function clearFilters() {
    setAccountId("");
    setFrom("");
    setTo("");
    setFParty("");
    setFSite("");
    setFHead("");
    setFSub("");
  }

  // Delete a payment row (an expense or a site-fund allocation). Uses the protected
  // transactions endpoint, which reverses the entry and refuses if money was already used.
  async function del(r: Row) {
    const ok = await confirm({
      title: "Delete this payment?",
      message: `${inr(r.credit)}${r.paid_to ? ` to ${r.paid_to}` : ""}${r.project_name ? ` · ${r.project_name}` : ""} will be removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/transactions/${r.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).message || "Could not delete", "error");
    toast("Payment deleted", "success");
    window.dispatchEvent(new CustomEvent("txn:created")); // refresh balances/dashboard
    load();
  }

  // Build the currently-filtered payments into the shared headers/rows — same columns as
  // the table — reused by both the CSV and PDF exports.
  function exportData() {
    const headers = ["#", "Date", "Party Name", isBank ? "Particular / Bill Details" : "Particular"]
      .concat(isBank ? ["Bank"] : [])
      .concat(["Net Payment", "Head", "Types of Head"]);
    const rows = filtered.map((r, i) => {
      const particular =
        r.type === "transfer" ? `Site fund → ${r.project_name ?? "site"}` : r.note || r.project_name || "";
      const base: (string | number)[] = [i + 1, formatDate(r.txn_date), r.paid_to || "", particular];
      if (isBank) base.push(r.source_name || "");
      base.push(
        Number(r.credit),
        r.type === "transfer" ? "Site Fund" : r.category_head || "",
        r.type === "transfer" ? "" : r.category || ""
      );
      return base;
    });
    return { headers, rows };
  }
  function exportCsv() {
    const { headers, rows } = exportData();
    downloadCsv(`${accountType}-book-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }
  function exportPdf() {
    const { headers, rows } = exportData();
    downloadPdf(title, headers, rows, { subtitle: `Exported ${formatDate(new Date().toISOString().slice(0, 10))}` });
  }

  // Bank sheet has an extra "Bank" column + "Particular / Bill Details" header, plus a
  // trailing actions (delete) column.
  const colCount = (isBank ? 8 : 7) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length} className="!py-2 text-sm">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={exportPdf} disabled={!filtered.length} className="!py-2 text-sm">
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <div className="rounded-lg bg-success/10 px-4 py-2 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Net Payment</p>
            <p className="text-lg font-bold text-success">{inr(netTotal)}</p>
          </div>
        </div>
      </div>

      {/* Info Note about how to add data */}
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
        <div className="text-muted-foreground">
          <span className="font-semibold text-foreground">How this works: </span>
          Data appears here automatically when you add a <span className="font-semibold text-foreground">Site Expense</span> or <span className="font-semibold text-foreground">Add Site Fund</span> and select a {typeNoun.toLowerCase()} account as the source. 
          {" "}<Link href="/guide#bank-cashbook" className="font-semibold text-primary hover:underline">Read the guide →</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{typeNoun} account</p>
          <CustomSelect
            value={accountId}
            onChange={setAccountId}
            onClear={() => setAccountId("")}
            options={[
              { label: `All ${typeNoun.toLowerCase()} accounts`, value: "" },
              ...accounts.map((a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: String(a.id) })),
            ]}
            placeholder={`All ${typeNoun.toLowerCase()} accounts`}
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">From</p>
          <CustomDatePicker value={from} onChange={setFrom} onClear={() => setFrom("")} maxDate={to || undefined} className="w-40" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">To</p>
          <CustomDatePicker value={to} onChange={setTo} onClear={() => setTo("")} minDate={from || undefined} className="w-40" align="right" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Party</p>
          <CustomSelect
            value={fParty}
            onChange={setFParty}
            onClear={() => setFParty("")}
            options={[{ label: "All Parties", value: "" }, ...partyOptions.map((p) => ({ label: p, value: p }))]}
            placeholder="All Parties"
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Site</p>
          <CustomSelect
            value={fSite}
            onChange={setFSite}
            onClear={() => setFSite("")}
            options={[{ label: "All Sites", value: "" }, ...siteOptions.map((s) => ({ label: s, value: s }))]}
            placeholder="All Sites"
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Head</p>
          <CustomSelect
            value={fHead}
            onChange={(val) => {
              setFHead(val);
              setFSub(""); // reset Type of Head when the Head changes
            }}
            onClear={() => {
              setFHead("");
              setFSub("");
            }}
            options={[{ label: "All Heads", value: "" }, ...headOptions.map((h) => ({ label: h, value: h }))]}
            placeholder="All Heads"
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Type of Head</p>
          <CustomSelect
            value={fSub}
            onChange={setFSub}
            onClear={() => setFSub("")}
            options={[{ label: "All Types", value: "" }, ...subOptions.map((s) => ({ label: s, value: s }))]}
            placeholder="All Types"
            className="w-44"
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex h-[42px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {/* Payment register */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Th>#</Th>
              <Th>Date</Th>
              <Th>Party Name</Th>
              <Th>{isBank ? "Particular / Bill Details" : "Particular"}</Th>
              {isBank && <Th>Bank</Th>}
              <Th right>Net Payment</Th>
              <Th>Head</Th>
              <Th>Types of Head</Th>
              <Th></Th>
            </THead>
            <TBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-3" colSpan={colCount}>
                      <div className="skeleton h-5 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : filtered.length ? (
                filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => r.project_id && router.push(`/projects/${r.project_id}`)}
                    className={`hover:bg-muted/30 ${r.project_id ? "cursor-pointer" : ""}`}
                    title={r.project_id ? `Open ${r.project_name ?? "site"}` : undefined}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDate(r.txn_date)}</td>
                    <td className="px-3 py-2.5 font-medium">{r.paid_to || "—"}</td>
                    <td className="px-3 py-2.5">
                      {r.type === "transfer" ? `Site fund → ${r.project_name ?? "site"}` : r.note || r.project_name || "—"}
                    </td>
                    {isBank && <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.source_name || "—"}</td>}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{inr(r.credit)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{r.type === "transfer" ? "Site Fund" : r.category_head || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {r.type === "transfer" ? "—" : r.category || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="danger" onClick={() => del(r)} className="!px-2 !py-1.5">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={colCount}>
                    <EmptyState>
                      No payments{accountId ? " from this account" : ` from any ${accountType} account`} in the selected period.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </TBody>
            {!loading && filtered.length > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2.5" colSpan={isBank ? 5 : 4}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right">{inr(netTotal)}</td>
                  <td className="px-3 py-2.5" colSpan={3} />
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </Card>
    </div>
  );
}
