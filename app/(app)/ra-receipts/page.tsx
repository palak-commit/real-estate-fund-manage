"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, FileText, RotateCcw, Wallet, X } from "lucide-react";
import { Card, Button, Input, Label, CustomSelect, CustomDatePicker, Skeleton, EmptyState } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import RaReceiptSheet, { type RaReceipt } from "@/components/RaReceiptSheet";
import RaPaymentsSheet from "@/components/RaPaymentsSheet";
import { inr, formatDate, ACCOUNT_TYPE_LABELS } from "@/lib/format";
import { computeRa, DEFAULT_RA_RATES, type RaRates } from "@/lib/ra";

const STATUS_LABEL: Record<string, string> = { pending: "Pending", partial: "Partially Paid", complete: "Complete" };
const STATUS_COLOR: Record<string, string> = { pending: "amber", partial: "blue", complete: "green" };

// The deduction rates that drive every derived column. Defaults match the Excel sheet;
// editable here so the whole register recomputes live (not persisted — a working setting).
const RATE_FIELDS: { key: keyof RaRates; label: string }[] = [
  { key: "gst", label: "GST" },
  { key: "tds", label: "TDS" },
  { key: "tdsGst", label: "TDS on GST" },
  { key: "sd", label: "SD" },
  { key: "cess", label: "Workman Cess" },
  { key: "subletGst", label: "Sub-let GST" },
];

export default function RaReceiptsPage() {
  const { toast, confirm } = useUI();
  const [rows, setRows] = useState<RaReceipt[] | null>(null);
  const [rates, setRates] = useState<RaRates>({ ...DEFAULT_RA_RATES });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RaReceipt | null>(null);
  const [payingFor, setPayingFor] = useState<RaReceipt | null>(null);
  // Filters
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSite, setFSite] = useState("");
  const [fAccount, setFAccount] = useState("");
  const [fStatus, setFStatus] = useState("");

  // Filter dropdowns list ALL sites / accounts (from the master lists), not just the ones
  // already used on a receipt — so any value is selectable.
  const [siteOptions, setSiteOptions] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<{ name: string; account_type: string }[]>([]);

  const load = () =>
    fetch("/api/ra-receipts")
      .then((r) => r.json())
      .then((j) => setRows(j.data));

  useEffect(() => {
    load();
    fetch("/api/projects").then((r) => r.json()).then((j) => setSiteOptions((j.data as any[]).map((p) => p.name)));
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data ?? []));
  }, []);

  // "Received In" options grouped by account type (Bank / Cash / Partner). Filter matches by
  // account name, so each item's value is the name.
  const accountFilterOptions = useMemo(
    () => [
      { label: "All Accounts", value: "" },
      ...(["bank", "cash", "partner"] as const)
        .map((t) => ({
          group: ACCOUNT_TYPE_LABELS[t],
          items: accounts.filter((a) => a.account_type === t).map((a) => ({ label: a.name, value: a.name })),
        }))
        .filter((g) => g.items.length > 0),
    ],
    [accounts]
  );

  const filtered = useMemo(
    () =>
      (rows || []).filter(
        (r) =>
          (!fFrom || (r.txn_date != null && r.txn_date >= fFrom)) &&
          (!fTo || (r.txn_date != null && r.txn_date <= fTo)) &&
          (!fSite || r.project_name === fSite) &&
          (!fAccount || r.account_name === fAccount) &&
          (!fStatus || r.status === fStatus)
      ),
    [rows, fFrom, fTo, fSite, fAccount, fStatus]
  );

  const hasFilters = !!(fFrom || fTo || fSite || fAccount || fStatus);
  function clearFilters() {
    setFFrom("");
    setFTo("");
    setFSite("");
    setFAccount("");
    setFStatus("");
  }

  const computed = useMemo(
    () => filtered.map((r) => ({ row: r, c: computeRa(r, rates) })),
    [filtered, rates]
  );

  // Column totals (the sheet's "Total" header row).
  const totals = useMemo(() => {
    const t = {
      amount: 0, gst: 0, total_bill: 0, tds: 0, tds_gst: 0, sd: 0, cess: 0,
      withheld_amt: 0, royalty: 0, total_deduction: 0, cheque_amt: 0,
      agency_charge: 0, net_receivable: 0, sub_let_bill: 0, sub_gst: 0,
    };
    for (const { row, c } of computed) {
      t.amount += Number(row.amount) || 0;
      t.withheld_amt += Number(row.withheld_amt) || 0;
      t.royalty += Number(row.royalty) || 0;
      t.agency_charge += Number(row.agency_charge) || 0;
      t.sub_let_bill += c.sub_let_bill;
      t.gst += c.gst; t.total_bill += c.total_bill; t.tds += c.tds; t.tds_gst += c.tds_gst;
      t.sd += c.sd; t.cess += c.cess; t.total_deduction += c.total_deduction;
      t.cheque_amt += c.cheque_amt; t.net_receivable += c.net_receivable; t.sub_gst += c.sub_gst;
    }
    return t;
  }, [computed]);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(r: RaReceipt) {
    setEditing(r);
    setSheetOpen(true);
  }
  async function del(r: RaReceipt) {
    const ok = await confirm({
      title: "Delete RA receipt?",
      message:
        Number(r.paid) > 0
          ? `This bill and its ${inr(r.paid)} of recorded payment(s) will be removed, and that amount reversed from the account(s) it credited.`
          : `The bill of ${inr(r.amount)} will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/ra-receipts/${r.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).message || "Could not delete", "error");
    window.dispatchEvent(new CustomEvent("txn:created")); // refresh accounts/dashboard if open
    toast("RA receipt deleted", "success");
    load();
  }

  const setRate = (k: keyof RaRates, v: string) =>
    setRates((r) => ({ ...r, [k]: v === "" ? 0 : Number(v) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Receipt of RA</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Receipt
        </Button>
      </div>

      {/* Editable rate set — drives every derived column below. */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Deduction Rates (%)</h2>
          <Button
            variant="ghost"
            onClick={() => setRates({ ...DEFAULT_RA_RATES })}
            className="!py-1 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {RATE_FIELDS.map((f) => (
            <label key={f.key} className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={String(rates[f.key])}
                onChange={(e) => setRate(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">From</p>
          <CustomDatePicker value={fFrom} onChange={setFFrom} onClear={() => setFFrom("")} maxDate={fTo || undefined} className="w-40" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">To</p>
          <CustomDatePicker value={fTo} onChange={setFTo} onClear={() => setFTo("")} minDate={fFrom || undefined} className="w-40" align="right" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Site</p>
          <CustomSelect
            value={fSite}
            onChange={setFSite}
            onClear={() => setFSite("")}
            options={[{ label: "All Sites", value: "" }, ...siteOptions.map((s) => ({ label: s, value: s }))]}
            placeholder="All Sites"
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Received In</p>
          <CustomSelect
            value={fAccount}
            onChange={setFAccount}
            onClear={() => setFAccount("")}
            options={accountFilterOptions}
            placeholder="All Accounts"
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <CustomSelect
            value={fStatus}
            onChange={setFStatus}
            onClear={() => setFStatus("")}
            options={[
              { label: "All Statuses", value: "" },
              { label: "Pending", value: "pending" },
              { label: "Partially Paid", value: "partial" },
              { label: "Complete", value: "complete" },
            ]}
            placeholder="All Statuses"
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

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[1800px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <Th>Sr. No.</Th>
              <Th>Date</Th>
              <Th>Site</Th>
              <Th>Paid To</Th>
              <Th>Received In</Th>
              <Th>Status</Th>
              <Th right>Amount</Th>
              <Th right>GST @ {rates.gst}%</Th>
              <Th right>Total Bill</Th>
              <Th right>TDS @ {rates.tds}%</Th>
              <Th right>TDS on GST @ {rates.tdsGst}%</Th>
              <Th right>SD @ {rates.sd}%</Th>
              <Th right>Workman Cess @ {rates.cess}%</Th>
              <Th right>Withheld Amt</Th>
              <Th right>Royalty</Th>
              <Th right>Total Deduction</Th>
              <Th right>Cheque Amt</Th>
              <Th right>Agency Charge</Th>
              <Th right>Net Receivable</Th>
              <Th right>Sub Let Bill</Th>
              <Th right>Sub-GST @ {rates.subletGst}%</Th>
              <Th right></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!rows ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={22} className="px-3 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : computed.length === 0 ? (
              <tr>
                <td colSpan={22}>
                  <EmptyState icon={<FileText className="h-8 w-8 text-muted-foreground/40" />}>
                    {hasFilters ? "No RA receipts match these filters." : "No RA receipts yet. Click “New Receipt” to add one."}
                  </EmptyState>
                </td>
              </tr>
            ) : (
              computed.map(({ row, c }, i) => (
                <tr
                  key={row.id}
                  onClick={() => setPayingFor(row)}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  title="View / add payments"
                >
                  <Td>{i + 1}</Td>
                  <Td>{row.txn_date ? formatDate(row.txn_date) : "—"}</Td>
                  <Td>{row.project_name || "—"}</Td>
                  <Td>{row.paid_to || "—"}</Td>
                  <Td>{row.account_name || "—"}</Td>
                  <Td><Label color={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</Label></Td>
                  <Td right>{inr(row.amount)}</Td>
                  <Td right>{inr(c.gst)}</Td>
                  <Td right>{inr(c.total_bill)}</Td>
                  <Td right>{inr(c.tds)}</Td>
                  <Td right>{inr(c.tds_gst)}</Td>
                  <Td right>{inr(c.sd)}</Td>
                  <Td right>{inr(c.cess)}</Td>
                  <Td right>{inr(row.withheld_amt)}</Td>
                  <Td right>{inr(row.royalty)}</Td>
                  <Td right>{inr(c.total_deduction)}</Td>
                  <Td right>{inr(c.cheque_amt)}</Td>
                  <Td right>{inr(row.agency_charge)}</Td>
                  <Td right className="font-semibold">{inr(c.net_receivable)}</Td>
                  <Td right>{inr(c.sub_let_bill)}</Td>
                  <Td right>{inr(c.sub_gst)}</Td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => setPayingFor(row)} className="!px-2 text-muted-foreground" >
                        <Wallet className="h-4 w-4" />
                      </Button>
                      {row.status !== "complete" && (
                        <Button variant="ghost" onClick={() => openEdit(row)} className="!px-2 text-muted-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => del(row)} className="!px-2">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {/* Totals row — shown at the bottom, like the Bank / Cashbook registers. */}
          {computed.length > 0 && (
            <tfoot className="border-t-2 border-border bg-muted/60 font-semibold">
              <tr>
                <td className="px-3 py-2.5" colSpan={6}>Total</td>
                <Td right>{inr(totals.amount)}</Td>
                <Td right>{inr(totals.gst)}</Td>
                <Td right>{inr(totals.total_bill)}</Td>
                <Td right>{inr(totals.tds)}</Td>
                <Td right>{inr(totals.tds_gst)}</Td>
                <Td right>{inr(totals.sd)}</Td>
                <Td right>{inr(totals.cess)}</Td>
                <Td right>{inr(totals.withheld_amt)}</Td>
                <Td right>{inr(totals.royalty)}</Td>
                <Td right>{inr(totals.total_deduction)}</Td>
                <Td right>{inr(totals.cheque_amt)}</Td>
                <Td right>{inr(totals.agency_charge)}</Td>
                <Td right>{inr(totals.net_receivable)}</Td>
                <Td right>{inr(totals.sub_let_bill)}</Td>
                <Td right>{inr(totals.sub_gst)}</Td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      <RaReceiptSheet
        open={sheetOpen}
        receipt={editing}
        rates={rates}
        onClose={() => setSheetOpen(false)}
        onSaved={() => {
          setSheetOpen(false);
          load();
        }}
      />

      <RaPaymentsSheet
        open={!!payingFor}
        receipt={payingFor}
        netReceivable={payingFor ? Number(payingFor.net_receivable) : 0}
        onClose={() => setPayingFor(null)}
        onChanged={load}
      />
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`whitespace-nowrap px-3 py-2.5 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
function Td({
  children,
  right,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return <td className={`whitespace-nowrap px-3 py-2.5 ${right ? "text-right" : ""} ${className}`}>{children}</td>;
}
