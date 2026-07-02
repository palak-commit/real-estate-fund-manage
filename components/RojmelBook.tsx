"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Info } from "lucide-react";
import Link from "next/link";
import { Card, CustomSelect, CustomDatePicker, EmptyState, Table, THead, TBody, Th } from "@/components/ui";
import { inr, formatDate, ACCOUNT_TYPE_LABELS } from "@/lib/format";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Row = {
  id: number;
  txn_date: string;
  type: string;
  note: string | null;
  paid_to: string | null;
  project_name: string | null;
  dest_name: string | null;
  category: string | null; // Type of Head (sub-head)
  category_head: string | null; // Head
  debit: number; // money IN
  credit: number; // money OUT
  balance: number; // running balance after this row
};
type Book = {
  account: Account | null;
  rows: Row[];
  summary: { opening: number; totalIn: number; totalOut: number; closing: number };
};

// A single day's daybook block, mirroring the Excel ROJMEL sheet: opening balance, the
// money received that day, every expense (with Head / Type of Head), and the closing balance.
type Day = {
  date: string;
  opening: number;
  received: number;
  totalExpense: number;
  closing: number;
  ins: Row[]; // money received that day (debit > 0)
  outs: Row[]; // payments that day (credit > 0)
};

// Rojmel = a running daybook for one account (bank / cash / partner). Unlike the flat payment
// registers, it groups by day with a per-day Opening Balance → Received → Expenses → Closing
// Balance, exactly like the Excel "ROJMEL" sheet.
export default function RojmelBook({ projectId }: { projectId?: number }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  // On a site page: the site's name + derived site-fund balance, for the "Site Fund" option.
  const [site, setSite] = useState<{ name: string; balance: number } | null>(null);

  // All accounts (bank / cash / partner). On a site page the picker also offers the site's
  // own "Site Fund" daybook (value "site"), which is the default there; otherwise default to
  // the first cash account (the classic Rojmel use), else the first account of any type.
  const loadAccounts = useCallback(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((j) => {
        const all = j.data as Account[];
        setAccounts(all);
        setAccountId(
          (cur) =>
            cur ||
            (projectId ? "site" : (all.find((a) => a.account_type === "cash") ?? all[0])?.id.toString() || "")
        );
      });
  }, [projectId]);

  useEffect(() => {
    loadAccounts();
    const h = () => loadAccounts();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [loadAccounts]);

  // Site name + site-fund balance for the "Site Fund" option (site page only). Refreshes on
  // any mutation so the shown balance stays current.
  useEffect(() => {
    if (!projectId) return;
    const loadSite = () =>
      fetch("/api/projects")
        .then((r) => r.json())
        .then((j) => {
          const p = (j.data as { id: number; name: string; balance: number }[] | undefined)?.find((x) => x.id === projectId);
          if (p) setSite({ name: p.name, balance: Number(p.balance) });
        });
    loadSite();
    window.addEventListener("txn:created", loadSite);
    return () => window.removeEventListener("txn:created", loadSite);
  }, [projectId]);

  const load = useCallback(() => {
    if (!accountId) {
      setBook(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams();
    if (accountId === "site" && projectId) qs.set("project_id", String(projectId));
    else qs.set("account_id", accountId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/accountbook?${qs}`)
      .then((r) => r.json())
      .then((j) => setBook(j.data ?? null))
      .finally(() => setLoading(false));
  }, [accountId, from, to, projectId]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  // Group the account ledger into per-day blocks. Rows arrive date-ascending with a running
  // balance, so a day's opening = (first row's balance − its debit + its credit) and its
  // closing = the last row's running balance.
  const days = useMemo<Day[]>(() => {
    const rows = book?.rows ?? [];
    const byDate = new Map<string, Row[]>();
    for (const r of rows) {
      if (!byDate.has(r.txn_date)) byDate.set(r.txn_date, []);
      byDate.get(r.txn_date)!.push(r);
    }
    const out: Day[] = [];
    for (const [date, rs] of byDate) {
      const first = rs[0];
      const opening = Number(first.balance) - Number(first.debit) + Number(first.credit);
      const closing = Number(rs[rs.length - 1].balance);
      out.push({
        date,
        opening,
        closing,
        received: rs.reduce((s, r) => s + Number(r.debit), 0),
        totalExpense: rs.reduce((s, r) => s + Number(r.credit), 0),
        ins: rs.filter((r) => Number(r.debit) > 0),
        outs: rs.filter((r) => Number(r.credit) > 0),
      });
    }
    return out;
  }, [book]);

  const hasFilters = !!(from || to);
  const COLS = 9;

  // Account options grouped by type (Bank / Cash / Partner), each showing its balance.
  // On a site page, the first group is the site's own "Site Fund" daybook.
  const accountOptions = [
    ...(projectId
      ? [{ group: "Site", items: [{ label: `${site?.name ?? "Site"} · Site Fund (${inr(site?.balance ?? 0)})`, value: "site" }] }]
      : []),
    ...(["bank", "cash", "partner"] as const)
      .map((t) => ({
        group: ACCOUNT_TYPE_LABELS[t],
        items: accounts
          .filter((a) => a.account_type === t)
          .map((a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: String(a.id) })),
      }))
      .filter((g) => g.items.length > 0),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Rojmel (Daybook)</h1>
        {book?.account && (
          <div className="rounded-lg bg-success/10 px-4 py-2 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Closing Balance</p>
            <p className="text-lg font-bold text-success">{inr(book.summary.closing)}</p>
          </div>
        )}
      </div>

      {/* Info Note about how to add data */}
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
        <div className="text-muted-foreground">
          <span className="font-semibold text-foreground">How this works: </span>
          Data appears here automatically when you add a <span className="font-semibold text-foreground">Site Expense</span> or <span className="font-semibold text-foreground">Add Site Fund</span> and select this account as the source.
          {" "}<Link href="/guide#rojmel" className="font-semibold text-primary hover:underline">Read the guide →</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Account</p>
          <CustomSelect
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
            placeholder="Select account…"
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
        {hasFilters && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="flex h-[42px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {/* Daybook */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th right>Received</Th>
              <Th right>Opening Balance</Th>
              <Th>Payment Reference</Th>
              <Th right>Amount</Th>
              <Th>Description</Th>
              <Th>Types of Head</Th>
              <Th>Head</Th>
              <Th right>Closing Balance</Th>
            </THead>
            <TBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-3" colSpan={COLS}>
                      <div className="skeleton h-5 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : !accountId ? (
                <tr>
                  <td colSpan={COLS}>
                    <EmptyState>Add an account to see its Rojmel.</EmptyState>
                  </td>
                </tr>
              ) : days.length ? (
                days.map((d) => (
                  <DayBlock key={d.date} day={d} />
                ))
              ) : (
                <tr>
                  <td colSpan={COLS}>
                    <EmptyState>No entries for this account in the selected period.</EmptyState>
                  </td>
                </tr>
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function DayBlock({ day }: { day: Day }) {
  return (
    <>
      {/* Opening row */}
      <tr className="bg-info/5 font-medium">
        <td className="whitespace-nowrap px-3 py-2.5">{formatDate(day.date)}</td>
        <td className="px-3 py-2.5 text-right text-success">{day.received ? inr(day.received) : "—"}</td>
        <td className="px-3 py-2.5 text-right">{inr(day.opening)}</td>
        <td className="px-3 py-2.5 text-muted-foreground" colSpan={6}>
          Opening Balance + Day Income
        </td>
      </tr>

      {/* Received-in lines */}
      {day.ins.map((r) => (
        <tr key={`in-${r.id}`}>
          <td className="px-3 py-2" />
          <td className="px-3 py-2 text-right font-medium text-success">{inr(r.debit)}</td>
          <td className="px-3 py-2" />
          <td className="px-3 py-2 text-muted-foreground" colSpan={6}>
            {r.note || r.paid_to || "Amount received"}
          </td>
        </tr>
      ))}

      {/* Expense lines */}
      {day.outs.map((r) => (
        <tr key={`out-${r.id}`}>
          <td className="px-3 py-2" />
          <td className="px-3 py-2" />
          <td className="px-3 py-2" />
          <td className="px-3 py-2 text-muted-foreground">{r.paid_to || "—"}</td>
          <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{inr(r.credit)}</td>
          <td className="px-3 py-2">
            {r.type === "transfer"
              ? r.dest_name
                ? `${r.project_name ?? "Site"} → ${r.dest_name}` // site-fund withdrawal into an account
                : `Site fund → ${r.project_name ?? "site"}` // account → site allocation (account ledgers)
              : r.note || r.project_name || "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{r.category || "—"}</td>
          <td className="whitespace-nowrap px-3 py-2">{r.type === "transfer" ? "Site Fund" : r.category_head || "—"}</td>
          <td className="px-3 py-2" />
        </tr>
      ))}

      {/* Day total / closing */}
      <tr className="border-t border-border bg-warning/5 font-semibold">
        <td className="px-3 py-2.5" colSpan={3} />
        <td className="px-3 py-2.5 text-right text-muted-foreground">Total Expense</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right text-danger">{inr(day.totalExpense)}</td>
        <td className="px-3 py-2.5" colSpan={3} />
        <td className="whitespace-nowrap px-3 py-2.5 text-right">{inr(day.closing)}</td>
      </tr>
    </>
  );
}
