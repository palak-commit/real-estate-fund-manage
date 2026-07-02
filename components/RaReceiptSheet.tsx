"use client";
import { useEffect, useState } from "react";
import { X, ChevronDown } from "lucide-react";
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
  ra_rates: Partial<RaRates> | string | null; // this receipt's own deduction rates (JSON)
  note: string | null;
  status: "pending" | "partial" | "complete";
  paid: number; // total received via partial payments
};

// Parse a receipt's stored ra_rates (object or JSON string) merged over the fallback rates.
export function ratesForReceipt(raw: RaReceipt["ra_rates"], fallback: RaRates): RaRates {
  if (!raw) return fallback;
  const obj = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  return obj ? { ...fallback, ...obj } : fallback;
}

export const RA_STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Partially Paid", value: "partial" },
  { label: "Complete", value: "complete" },
];

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Project = { id: number; name: string; balance?: number; status?: string };

const blank = {
  txn_date: "", project_id: "", account_id: "", paid_to: "", status: "pending",
  amount: "", withheld_amt: "", royalty: "", agency_charge: "", sub_let_bill: "", note: "",
};

// The editable per-receipt deduction rates (percentages).
const RATE_FIELDS: { key: keyof RaRates; label: string }[] = [
  { key: "gst", label: "GST %" },
  { key: "tds", label: "TDS %" },
  { key: "tdsGst", label: "TDS on GST %" },
  { key: "sd", label: "SD %" },
  { key: "cess", label: "Workman Cess %" },
  { key: "subletGst", label: "Sub-let GST %" },
];

export default function RaReceiptSheet({
  open,
  receipt,
  rates,
  onClose,
  onSaved,
  defaultProjectId,
}: {
  open: boolean;
  receipt: RaReceipt | null; // null = create, set = edit
  rates: RaRates;
  onClose: () => void;
  onSaved: () => void;
  defaultProjectId?: number | null; // preselect this site on create (e.g. from a site page)
}) {
  const { toast } = useUI();
  const [form, setForm] = useState({ ...blank });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // This receipt's own deduction rates. Seeded from the receipt (edit) or the site/default
  // rates (create); editing them affects only THIS receipt, and the latest set is saved back
  // to the site so the next receipt defaults to it.
  const [formRates, setFormRates] = useState<RaRates>(rates);
  const [ratesOpen, setRatesOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data ?? []));
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setRatesOpen(false);
    // Edit → this receipt's own rates (fall back to the site rates); Create → the site rates.
    setFormRates(receipt ? ratesForReceipt(receipt.ra_rates, rates) : rates);
    setForm(
      receipt
        ? {
            txn_date: receipt.txn_date || "",
            project_id: receipt.project_id ? String(receipt.project_id) : "",
            // No account but a site → it was received into the site's funds ("site" sentinel).
            account_id: receipt.account_id ? String(receipt.account_id) : receipt.project_id ? "site" : "",
            paid_to: receipt.paid_to || "",
            status: receipt.status || "pending",
            amount: String(receipt.amount ?? ""),
            withheld_amt: receipt.withheld_amt ? String(receipt.withheld_amt) : "",
            royalty: receipt.royalty ? String(receipt.royalty) : "",
            agency_charge: receipt.agency_charge ? String(receipt.agency_charge) : "",
            sub_let_bill: receipt.sub_let_bill ? String(receipt.sub_let_bill) : "",
            note: receipt.note || "",
          }
        : { ...blank, project_id: defaultProjectId ? String(defaultProjectId) : "" }
    );
  }, [open, receipt, defaultProjectId]);

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
    formRates
  );

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Received In options: the selected site's own funds ("Site Fund", value "site" — needs a
  // site, labelled with the site name + its fund balance) then accounts grouped by type
  // (Bank / Cash / Partner), each showing its available balance.
  const selectedProject = projects.find((p) => String(p.id) === form.project_id);
  const siteFundLabel = `${selectedProject?.name ?? "Site"} · Site Fund${
    selectedProject?.balance != null ? ` (${inr(selectedProject.balance)})` : ""
  }`;
  const accountOptions = [
    ...(form.project_id ? [{ group: "Site", items: [{ label: siteFundLabel, value: "site" }] }] : []),
    ...(["bank", "cash", "partner"] as const)
      .map((t) => ({
        group: ACCOUNT_TYPE_LABELS[t],
        items: accounts
          .filter((a) => a.account_type === t)
          .map((a) => ({ label: `${a.name} · ${inr(a.current_balance)}`, value: String(a.id) })),
      }))
      .filter((g) => g.items.length > 0),
  ];
  const intoLabel = form.account_id === "site" ? "this site's funds" : "this account";

  async function submit() {
    setErr("");
    if (!form.txn_date) return setErr("Please select a date");
    if (!form.amount || Number(form.amount) <= 0) return setErr("Enter a valid amount");
    if (!form.project_id) return setErr("Please select a site");
    if (!form.account_id) return setErr("Please select where it was received");
    // "site" is the site-fund sentinel → no account (money lands in the site's funds).
    const accountId = form.account_id === "site" ? null : form.account_id || null;
    const payload = {
      txn_date: form.txn_date || null,
      project_id: form.project_id || null,
      account_id: accountId,
      paid_to: form.paid_to || null,
      amount: form.amount,
      withheld_amt: form.withheld_amt || 0,
      royalty: form.royalty || 0,
      agency_charge: form.agency_charge || 0,
      sub_let_bill: form.sub_let_bill || 0,
      note: form.note || null,
      status: form.status,
      net_receivable: preview.net_receivable, // advisory only — the server recomputes from `rates`
      rates: formRates, // this receipt's rate set — server persists it + derives the net from it
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
              // On CREATE only Active sites can take a new receipt; on EDIT keep the receipt's
              // existing site listed even if it's since gone On-Hold / Completed.
              options={projects
                .filter((p) => receipt || p.status === "active")
                .map((p) => ({ label: p.name, value: String(p.id) }))}
              placeholder="Select site"
              // Locked to the current site when opened from a site page (create only).
              disabled={!receipt && defaultProjectId != null}
            />
          </Field>
          <Field label="Received In" required hint="receivedIn">
            <CustomSelect
              value={form.account_id}
              onChange={(v) => setField("account_id", v)}
              options={accountOptions}
              placeholder="Bank / Cash / Partner / Site Fund"
            />
            {!receipt && form.account_id && form.status === "complete" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Status is Complete → saving credits {inr(preview.net_receivable)} into {intoLabel}.
              </p>
            )}
            {!receipt && form.account_id && form.status !== "complete" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Pending → no money is added yet. Set status to Complete (or add payments later) to credit {intoLabel}.
              </p>
            )}
          </Field>
          <div className="col-span-2">
            <Field label="Received From (optional)">
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

        {/* Per-receipt deduction rates — changing them affects only THIS receipt (and becomes
            the site's default for the next one). Collapsed by default. */}
        <div className="mt-3 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setRatesOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
          >
            <span>Deduction Rates (this receipt)</span>
            <ChevronDown className={`h-4 w-4 transition ${ratesOpen ? "rotate-180" : ""}`} />
          </button>
          {ratesOpen && (
            <div className="grid grid-cols-2 gap-3 border-t border-border p-3 sm:grid-cols-3">
              {RATE_FIELDS.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <Input
                    inputMode="decimal"
                    value={String(formRates[key])}
                    onChange={(e) =>
                      setFormRates((r) => ({ ...r, [key]: Number(sanitizeAmount(e.target.value)) || 0 }))
                    }
                    placeholder="0"
                  />
                </Field>
              ))}
            </div>
          )}
        </div>

        {/* Step-wise preview of how the raw inputs expand into the Net Receivable, using THIS
            receipt's rates. Deductions are subtracted from the Total Bill line-by-line. */}
        <div className="mt-4 space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
          <CalcLine label="Amount" value={num(form.amount)} />
          <CalcLine label={`GST @ ${formRates.gst}%`} value={preview.gst} sign="+" />
          <CalcLine label="Total Bill" value={preview.total_bill} subtotal />

          <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Deductions</p>
          <CalcLine label={`TDS @ ${formRates.tds}%`} value={preview.tds} sign="−" indent />
          <CalcLine label={`TDS on GST @ ${formRates.tdsGst}%`} value={preview.tds_gst} sign="−" indent />
          <CalcLine label={`SD @ ${formRates.sd}%`} value={preview.sd} sign="−" indent />
          <CalcLine label={`Workman Cess @ ${formRates.cess}%`} value={preview.cess} sign="−" indent />
          {num(form.withheld_amt) > 0 && <CalcLine label="Withheld Amt" value={num(form.withheld_amt)} sign="−" indent />}
          {num(form.royalty) > 0 && <CalcLine label="Royalty" value={num(form.royalty)} sign="−" indent />}
          <CalcLine label="Total Deduction" value={preview.total_deduction} sign="−" subtotal />

          <CalcLine label="Cheque Amt" value={preview.cheque_amt} subtotal />
          {num(form.agency_charge) > 0 && <CalcLine label="Agency Charge" value={num(form.agency_charge)} sign="−" />}
          <CalcLine label="Net Receivable" value={preview.net_receivable} total />
        </div>

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={submit} loading={saving} className="mt-5 w-full !py-3 text-base">
          {receipt ? "Save Changes" : "Add Receipt"}
        </Button>
      </div>
    </div>
  );
}

// One line of the step-wise calculation. `sign` prefixes a +/− (and colors the value);
// `subtotal` draws a top divider + bold label; `total` is the final emphasized line.
function CalcLine({
  label,
  value,
  sign,
  indent,
  subtotal,
  total,
}: {
  label: string;
  value: number;
  sign?: "+" | "−";
  indent?: boolean;
  subtotal?: boolean;
  total?: boolean;
}) {
  const valueColor = sign === "+" ? "text-success" : sign === "−" ? "text-danger" : "";
  return (
    <div
      className={`flex items-center justify-between ${
        subtotal || total ? "border-t border-border pt-1.5" : ""
      } ${indent ? "pl-3" : ""}`}
    >
      <span className={subtotal || total ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`${total ? "font-bold" : subtotal ? "font-semibold" : `font-medium ${valueColor}`}`}>
        {sign ? `${sign} ` : ""}
        {inr(value)}
      </span>
    </div>
  );
}
