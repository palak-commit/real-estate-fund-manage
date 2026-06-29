"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CustomSelect, CustomDatePicker, EmptyState } from "@/components/ui";
import { inr, formatDate } from "@/lib/format";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Row = {
  id: number;
  txn_date: string;
  type: string;
  note: string | null;
  paid_to: string | null;
  source_name: string | null;
  dest_name: string | null;
  project_name: string | null;
  category: string | null;
  category_head: string | null;
  debit: number;
  credit: number;
  balance: number;
};
type Book = {
  account: Account;
  rows: Row[];
  summary: { opening: number; totalIn: number; totalOut: number; closing: number };
};

// Bank / Cashbook are PAYMENT registers (the Excel "BANK" / "CASHBOOK" sheets): the
// expenses paid out of the selected account, categorised by Head / Sub-Head, with a
// Net Payment total. (Money coming IN is shown on the Dashboard / account ledger.)
export default function AccountBook({ accountType, title }: { accountType: "bank" | "cash"; title: string }) {
  const isBank = accountType === "bank";
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

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data as Account[]).filter((a) => a.account_type === accountType);
        setAccounts(list);
        setAccountId((prev) => prev || (list[0] ? String(list[0].id) : ""));
      });
  }, [accountType]);

  const load = useCallback(() => {
    if (!accountId) {
      setBook(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams({ account_id: accountId });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/accountbook?${qs}`)
      .then((r) => r.json())
      .then((j) => setBook(j.data ?? null))
      .finally(() => setLoading(false));
  }, [accountId, from, to]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  // Only the payments (expenses) out of this account — that's what the Excel sheets list.
  const payments = useMemo(() => (book?.rows ?? []).filter((r) => r.type === "expense"), [book]);

  // Distinct filter options, derived from this account's payments.
  const uniq = (vals: (string | null)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const partyOptions = useMemo(() => uniq(payments.map((r) => r.paid_to)), [payments]);
  const siteOptions = useMemo(() => uniq(payments.map((r) => r.project_name)), [payments]);
  const headOptions = useMemo(() => uniq(payments.map((r) => r.category_head)), [payments]);
  // Sub-heads cascade from the chosen Head (or all sub-heads when no head is selected).
  const subOptions = useMemo(
    () => uniq(payments.filter((r) => !fHead || r.category_head === fHead).map((r) => r.category)),
    [payments, fHead]
  );

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

  // Bank sheet has an extra "Bank" column + "Particular / Bill Details" header.
  const colCount = isBank ? 8 : 7;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="rounded-lg bg-success/10 px-4 py-2 text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Net Payment</p>
          <p className="text-lg font-bold text-success">{inr(netTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{isBank ? "Bank account" : "Cash account"}</p>
          <CustomSelect
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: String(a.id) }))}
            placeholder={`Select ${accountType} account…`}
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
      </div>

      {/* Payment register */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">#</th>
                <th className="px-3 py-2.5 text-left font-medium">Date</th>
                <th className="px-3 py-2.5 text-left font-medium">Party Name</th>
                <th className="px-3 py-2.5 text-left font-medium">{isBank ? "Particular / Bill Details" : "Particular"}</th>
                {isBank && <th className="px-3 py-2.5 text-left font-medium">Bank</th>}
                <th className="px-3 py-2.5 text-right font-medium">Net Payment</th>
                <th className="px-3 py-2.5 text-left font-medium">Head</th>
                <th className="px-3 py-2.5 text-left font-medium">Types of Head</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDate(r.txn_date)}</td>
                    <td className="px-3 py-2.5 font-medium">{r.paid_to || "—"}</td>
                    <td className="px-3 py-2.5">{r.note || r.project_name || "—"}</td>
                    {isBank && <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{book?.account.name}</td>}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{inr(r.credit)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{r.category_head || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {r.category && r.category !== r.category_head ? r.category : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={colCount}>
                    <EmptyState>
                      No payments{accountId ? " from this account in the selected period" : " — add an account first"}.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2.5" colSpan={isBank ? 5 : 4}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right">{inr(netTotal)}</td>
                  <td className="px-3 py-2.5" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
