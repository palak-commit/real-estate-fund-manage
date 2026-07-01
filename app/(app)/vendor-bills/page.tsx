"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ClipboardList, Wallet, X, Download, Info } from "lucide-react";
import { Card, Button, Input, Label, CustomSelect, CustomDatePicker, Skeleton, EmptyState, Table, THead, TBody, Th, Td } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import Link from "next/link";
import VendorBillSheet, { type VendorBill } from "@/components/VendorBillSheet";
import VendorPaymentsSheet from "@/components/VendorPaymentsSheet";
import { inr, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

const STATUS_LABEL: Record<string, string> = { pending: "Pending", partial: "Partially Paid", complete: "Complete" };
const STATUS_COLOR: Record<string, string> = { pending: "amber", partial: "blue", complete: "green" };

export default function VendorBillsPage() {
  const { toast, confirm } = useUI();
  const [rows, setRows] = useState<VendorBill[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<VendorBill | null>(null);
  const [payingFor, setPayingFor] = useState<VendorBill | null>(null);
  // Filters
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSite, setFSite] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fVendor, setFVendor] = useState(""); // free-text vendor name search
  const [vendorFocus, setVendorFocus] = useState(false); // show the vendor suggestion dropdown
  const [siteOptions, setSiteOptions] = useState<string[]>([]);

  const load = () =>
    fetch("/api/vendor-bills")
      .then((r) => r.json())
      .then((j) => setRows(j.data));

  useEffect(() => {
    load();
    fetch("/api/projects").then((r) => r.json()).then((j) => setSiteOptions((j.data as any[]).map((p) => p.name)));
  }, []);

  const filtered = useMemo(
    () =>
      (rows || []).filter(
        (r) =>
          (!fFrom || (r.txn_date != null && r.txn_date >= fFrom)) &&
          (!fTo || (r.txn_date != null && r.txn_date <= fTo)) &&
          (!fSite || r.project_name === fSite) &&
          (!fStatus || r.status === fStatus) &&
          (!fVendor || (r.paid_to ?? "").toLowerCase().includes(fVendor.trim().toLowerCase()))
      ),
    [rows, fFrom, fTo, fSite, fStatus, fVendor]
  );

  // Distinct vendor names from the loaded bills, for the search autocomplete.
  const vendorNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows || []) if (r.paid_to) set.add(r.paid_to);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const vendorMatches = useMemo(() => {
    const q = fVendor.trim().toLowerCase();
    if (!q) return vendorNames.slice(0, 8); // show a few suggestions even before typing
    return vendorNames.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 8);
  }, [vendorNames, fVendor]);

  const hasFilters = !!(fFrom || fTo || fSite || fStatus || fVendor);
  function clearFilters() {
    setFFrom("");
    setFTo("");
    setFSite("");
    setFStatus("");
    setFVendor("");
  }

  // Column totals (the register's "Total" row).
  const totals = useMemo(() => {
    const t = { amount: 0, gst: 0, total_bill: 0, paid: 0, balance: 0 };
    for (const r of filtered) {
      t.amount += Number(r.amount) || 0;
      t.gst += Number(r.gst) || 0;
      t.total_bill += Number(r.total_bill) || 0;
      t.paid += Number(r.paid) || 0;
      t.balance += Math.max(Number(r.total_bill) - Number(r.paid), 0);
    }
    return t;
  }, [filtered]);

  function exportCsv() {
    const headers = ["Sr. No", "Date", "Site", "Vendor", "Head", "Note", "Amount", "GST", "Total Bill", "Paid", "Remaining", "Status"];
    const data = filtered.map((r, i) => [
      i + 1,
      r.txn_date ? formatDate(r.txn_date) : "",
      r.project_name || "",
      r.paid_to || "",
      r.category_head || "",
      r.note || "",
      Number(r.amount) || 0,
      Number(r.gst) || 0,
      Number(r.total_bill) || 0,
      Number(r.paid) || 0,
      Math.max(Number(r.total_bill) - Number(r.paid), 0),
      STATUS_LABEL[r.status] || r.status || "",
    ]);
    downloadCsv(`vendor-bills-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  }

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(r: VendorBill) {
    setEditing(r);
    setSheetOpen(true);
  }
  async function del(r: VendorBill) {
    const ok = await confirm({
      title: "Delete vendor bill?",
      message:
        Number(r.paid) > 0
          ? `This bill and its ${inr(r.paid)} of recorded payment(s) will be removed, and that amount reversed from the account/site it was paid from.`
          : `The bill of ${inr(r.total_bill)} will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/vendor-bills/${r.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).message || "Could not delete", "error");
    window.dispatchEvent(new CustomEvent("txn:created")); // refresh accounts/dashboard if open
    toast("Vendor bill deleted", "success");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendor Bills</h1>
          <p className="text-sm text-muted-foreground">Money owed to vendors — record bills, then pay them down.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> New Bill
          </Button>
        </div>
      </div>

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
        <div className="relative space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Vendor</p>
          <Input
            value={fVendor}
            onChange={(e) => setFVendor(e.target.value)}
            onFocus={() => setVendorFocus(true)}
            onBlur={() => setVendorFocus(false)}
            placeholder="Search vendor…"
            className="w-44"
          />
          {vendorFocus && vendorMatches.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-44 overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
              {vendorMatches.map((n) => (
                <button
                  key={n}
                  type="button"
                  // onMouseDown (not onClick) so the pick registers before the input's blur fires.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setFVendor(n);
                    setVendorFocus(false);
                  }}
                  className="block w-full truncate px-3 py-1.5 text-left text-sm transition hover:bg-muted"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
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

      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
        <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
        <p className="text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">How this works: </span>
          Creating a bill only records what you owe. Click on a bill row to add a <span className="font-medium text-foreground">Payment</span>, which automatically posts an expense and deducts the funds. <Link href="/guide#vendor-bills" className="font-medium text-primary hover:underline">Read the guide</Link>
        </p>
      </div>

      <Card className="overflow-x-auto">
        <Table minWidth={1150}>
          <THead>
            <Th>Sr. No.</Th>
            <Th>Date</Th>
            <Th>Site</Th>
            <Th>Vendor</Th>
            <Th>Head</Th>
            <Th>Note</Th>
            <Th right>Amount</Th>
            <Th right>GST</Th>
            <Th right>Total Bill</Th>
            <Th right>Paid</Th>
            <Th right>Remaining</Th>
            <Th>Status</Th>
            <Th right></Th>
          </THead>
          <TBody>
            {!rows ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={13} className="px-3 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={13}>
                  <EmptyState
                    icon={<ClipboardList className="h-8 w-8 text-muted-foreground/40" />}
                    action={
                      hasFilters ? (
                        <Button variant="outline" onClick={clearFilters} className="!py-1.5 text-xs">
                          <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                      ) : (
                        <Button onClick={openNew} className="!py-1.5 text-xs">
                          <Plus className="h-3.5 w-3.5" /> New Bill
                        </Button>
                      )
                    }
                  >
                    {hasFilters ? "No vendor bills match these filters." : "No vendor bills yet. Record your first bill."}
                  </EmptyState>
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => {
                const balance = Math.max(Number(row.total_bill) - Number(row.paid), 0);
                return (
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
                    <Td>{row.category_head || "—"}</Td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-muted-foreground" title={row.note || ""}>
                      {row.note || "—"}
                    </td>
                    <Td right>{inr(row.amount)}</Td>
                    <Td right>{inr(row.gst)}</Td>
                    <Td right className="font-semibold">{inr(row.total_bill)}</Td>
                    <Td right className="text-success">{inr(row.paid)}</Td>
                    <Td right className={balance > 0 ? "font-semibold text-danger" : ""}>{inr(balance)}</Td>
                    <Td><Label color={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</Label></Td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => setPayingFor(row)} className="!px-2 text-muted-foreground">
                          <Wallet className="h-4 w-4" />
                        </Button>
                        {/* Edit is always available — raising a fully-paid "advance" bill's
                            amount re-opens its balance (status auto-flips to Partially Paid). */}
                        <Button variant="ghost" onClick={() => openEdit(row)} className="!px-2 text-muted-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="danger" onClick={() => del(row)} className="!px-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </TBody>
          {/* Totals row */}
          {filtered.length > 0 && (
            <tfoot className="border-t-2 border-border bg-muted/60 font-semibold">
              <tr>
                <td className="px-3 py-2.5" colSpan={6}>Total</td>
                <Td right>{inr(totals.amount)}</Td>
                <Td right>{inr(totals.gst)}</Td>
                <Td right>{inr(totals.total_bill)}</Td>
                <Td right>{inr(totals.paid)}</Td>
                <Td right>{inr(totals.balance)}</Td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </Table>
      </Card>

      <VendorBillSheet
        open={sheetOpen}
        bill={editing}
        onClose={() => setSheetOpen(false)}
        onSaved={() => {
          setSheetOpen(false);
          load();
        }}
      />

      <VendorPaymentsSheet
        open={!!payingFor}
        bill={payingFor}
        totalBill={payingFor ? Number(payingFor.total_bill) : 0}
        onClose={() => setPayingFor(null)}
        onChanged={load}
      />
    </div>
  );
}

