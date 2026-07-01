"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker, Field } from "@/components/ui";
import PaidToPicker from "@/components/PaidToPicker";
import { useUI } from "@/components/UIProvider";
import { inr, sanitizeAmount, ACCOUNT_TYPE_LABELS } from "@/lib/format";
import { computeRa, type RaRates } from "@/lib/ra";

export type RaReceipt = {
  id: number;
  txn_date: string | null;
  project_id: number | null;
  project_name: string | null;
  account_id: number | null;
  account_name: string | null;
  paid_to: string | null;
  amount: number;
  withheld_amt: number;
  royalty: number;
  agency_charge: number;
  sub_let_bill: number;
  net_receivable: number; // server-persisted snapshot (authoritative for the payment balance)
  note: string | null;
  status: "pending" | "partial" | "complete";
  paid: number; // total received via partial payments
};

export const RA_STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Partially Paid", value: "partial" },
  { label: "Complete", value: "complete" },
];

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Project = { id: number; name: string };

const blank = {
  txn_date: "", project_id: "", account_id: "", paid_to: "", status: "pending",
  amount: "", withheld_amt: "", royalty: "", agency_charge: "", sub_let_bill: "", note: "",
};

export default function RaReceiptSheet({
  open,
  receipt,
  rates,
  onClose,
  onSaved,
}: {
  open: boolean;
  receipt: RaReceipt | null; // null = create, set = edit
  rates: RaRates;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useUI();
  const [form, setForm] = useState({ ...blank });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data ?? []));
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setForm(
      receipt
        ? {
            txn_date: receipt.txn_date || "",
            project_id: receipt.project_id ? String(receipt.project_id) : "",
            account_id: receipt.account_id ? String(receipt.account_id) : "",
            paid_to: receipt.paid_to || "",
            status: receipt.status || "pending",
            amount: String(receipt.amount ?? ""),
            withheld_amt: receipt.withheld_amt ? String(receipt.withheld_amt) : "",
            royalty: receipt.royalty ? String(receipt.royalty) : "",
            agency_charge: receipt.agency_charge ? String(receipt.agency_charge) : "",
            sub_let_bill: receipt.sub_let_bill ? String(receipt.sub_let_bill) : "",
            note: receipt.note || "",
          }
        : { ...blank }
    );
  }, [open, receipt]);

  if (!open) return null;

  const num = (v: string) => Number(v) || 0;
  const preview = computeRa(
    {
      amount: num(form.amount),
      withheld_amt: num(form.withheld_amt),
      royalty: num(form.royalty),
      agency_charge: num(form.agency_charge),
      sub_let_bill: num(form.sub_let_bill),
    },
    rates
  );

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Accounts grouped by type (Bank / Cash / Partner), each showing its available balance.
  const accountOptions = [
    ...(["bank", "cash", "partner"] as const)
      .map((t) => ({
        group: ACCOUNT_TYPE_LABELS[t],
        items: accounts
          .filter((a) => a.account_type === t)
          .map((a) => ({ label: `${a.name} · ${inr(a.current_balance)}`, value: String(a.id) })),
      }))
      .filter((g) => g.items.length > 0),
  ];

  async function submit() {
    setErr("");
    if (!form.txn_date) return setErr("Please select a date");
    if (!form.amount || Number(form.amount) <= 0) return setErr("Enter a valid amount");
    if (!form.project_id) return setErr("Please select a site");
    if (!form.account_id) return setErr("Please select where it was received");
    const payload = {
      txn_date: form.txn_date || null,
      project_id: form.project_id || null,
      account_id: form.account_id || null,
      paid_to: form.paid_to || null,
      amount: form.amount,
      withheld_amt: form.withheld_amt || 0,
      royalty: form.royalty || 0,
      agency_charge: form.agency_charge || 0,
      sub_let_bill: form.sub_let_bill || 0,
      note: form.note || null,
      status: form.status,
      net_receivable: preview.net_receivable, // advisory only — the server recomputes from `rates`
      rates, // the deduction rate set used for the preview, so the server derives the same net
    };
    setSaving(true);
    const res = await fetch(receipt ? `/api/ra-receipts/${receipt.id}` : "/api/ra-receipts", {
      method: receipt ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");
    window.dispatchEvent(new CustomEvent("txn:created")); // refresh accounts/dashboard if open
    toast(receipt ? "RA receipt updated" : "RA receipt added", "success");
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{receipt ? "Edit RA Receipt" : "New RA Receipt"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <CustomDatePicker value={form.txn_date} onChange={(v) => setField("txn_date", v)} />
          </Field>
          <Field label="Amount" required>
            <Input
              autoFocus
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setField("amount", sanitizeAmount(e.target.value))}
              placeholder="0"
            />
          </Field>
          <Field label="Site" required>
            <CustomSelect
              value={form.project_id}
              onChange={(v) => setField("project_id", v)}
              options={projects.map((p) => ({ label: p.name, value: String(p.id) }))}
              placeholder="Select site"
            />
          </Field>
          <Field label="Received In" required>
            <CustomSelect
              value={form.account_id}
              onChange={(v) => setField("account_id", v)}
              options={accountOptions}
              placeholder="Bank / Cash / Partner"
            />
            {!receipt && form.account_id && form.status === "complete" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Status is Complete → saving credits {inr(preview.net_receivable)} into this account.
              </p>
            )}
            {!receipt && form.account_id && form.status !== "complete" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Pending → no money is added yet. Set status to Complete (or add payments later) to credit this account.
              </p>
            )}
          </Field>
          <div className="col-span-2">
            <Field label="Paid To (optional)">
              <PaidToPicker value={form.paid_to} onChange={(v) => setField("paid_to", v)} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Status" required>
              <CustomSelect
                value={form.status}
                onChange={(v) => setField("status", v)}
                // A new receipt has no payments yet, so "Partially Paid" can't apply.
                options={receipt ? RA_STATUS_OPTIONS : RA_STATUS_OPTIONS.filter((o) => o.value !== "partial")}
              />
            </Field>
          </div>
          <Field label="Withheld Amt">
            <Input
              inputMode="decimal"
              value={form.withheld_amt}
              onChange={(e) => setField("withheld_amt", sanitizeAmount(e.target.value))}
              placeholder="0"
            />
          </Field>
          <Field label="Royalty">
            <Input
              inputMode="decimal"
              value={form.royalty}
              onChange={(e) => setField("royalty", sanitizeAmount(e.target.value))}
              placeholder="0"
            />
          </Field>
          <Field label="Agency Charge">
            <Input
              inputMode="decimal"
              value={form.agency_charge}
              onChange={(e) => setField("agency_charge", sanitizeAmount(e.target.value))}
              placeholder="0"
            />
          </Field>
          <Field label="Sub Let Bill">
            <Input
              inputMode="decimal"
              value={form.sub_let_bill}
              onChange={(e) => setField("sub_let_bill", sanitizeAmount(e.target.value))}
              placeholder="0"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Note (optional)">
            <Input value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Party / bill details" />
          </Field>
        </div>

        {/* Live preview of the derived figures using the current page rates. */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
          <Row label={`GST @ ${rates.gst}%`} value={preview.gst} />
          <Row label="Total Bill" value={preview.total_bill} />
          <Row label="Total Deduction" value={preview.total_deduction} />
          <Row label="Cheque Amt" value={preview.cheque_amt} />
          <Row label="Net Receivable" value={preview.net_receivable} bold />
          <Row label={`Sub-GST @ ${rates.subletGst}%`} value={preview.sub_gst} />
        </div>

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={submit} loading={saving} className="mt-5 w-full !py-3 text-base">
          {receipt ? "Save Changes" : "Add Receipt"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{inr(value)}</span>
    </div>
  );
}
