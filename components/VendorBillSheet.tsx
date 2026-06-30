"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker, Field } from "@/components/ui";
import PaidToPicker from "@/components/PaidToPicker";
import CategoryPicker from "@/components/CategoryPicker";
import { useUI } from "@/components/UIProvider";
import { inr, sanitizeAmount } from "@/lib/format";

export type VendorBill = {
  id: number;
  txn_date: string | null;
  project_id: number;
  project_name: string | null;
  category_id: number | null;
  category: string | null; // Type of Head (leaf) name, when set
  category_head: string | null; // Head name
  paid_to: string | null;
  amount: number;
  gst: number;
  total_bill: number; // server-persisted snapshot (authoritative for the payment balance)
  note: string | null;
  status: "pending" | "partial" | "complete";
  paid: number; // total paid via payments
};

type Project = { id: number; name: string };

const blank = { txn_date: "", project_id: "", category_id: "", paid_to: "", amount: "", gst_pct: "", note: "" };
const GST_PRESETS = ["0", "5", "12", "18", "28"];

export default function VendorBillSheet({
  open,
  bill,
  onClose,
  onSaved,
}: {
  open: boolean;
  bill: VendorBill | null; // null = create, set = edit
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useUI();
  const [form, setForm] = useState({ ...blank });
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setForm(
      bill
        ? {
            txn_date: bill.txn_date || "",
            project_id: bill.project_id ? String(bill.project_id) : "",
            category_id: bill.category_id ? String(bill.category_id) : "",
            paid_to: bill.paid_to || "",
            amount: String(bill.amount ?? ""),
            // Stored GST is an amount; show it back as the % of the bill amount it represents.
            gst_pct: bill.gst && bill.amount ? String(Math.round((Number(bill.gst) / Number(bill.amount)) * 10000) / 100) : "",
            note: bill.note || "",
          }
        : { ...blank }
    );
  }, [open, bill]);

  if (!open) return null;

  const num = (v: string) => Number(v) || 0;
  // GST is entered as a percentage; the rupee amount is derived (rounded to paise).
  const gstAmount = Math.round(num(form.amount) * num(form.gst_pct)) / 100;
  const totalBill = num(form.amount) + gstAmount;

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr("");
    if (!form.txn_date) return setErr("Please select a date");
    if (!form.project_id) return setErr("Please select a site");
    if (!form.amount || Number(form.amount) <= 0) return setErr("Enter a valid amount");
    const payload = {
      txn_date: form.txn_date || null,
      project_id: form.project_id,
      category_id: form.category_id || null,
      paid_to: form.paid_to || null,
      amount: form.amount,
      gst: gstAmount, // computed from the GST % above; server stores the rupee amount
      note: form.note || null,
      // Preserve the bill's payment-derived status on edit; a new bill always starts pending.
      status: bill ? bill.status : "pending",
    };
    setSaving(true);
    const res = await fetch(bill ? `/api/vendor-bills/${bill.id}` : "/api/vendor-bills", {
      method: bill ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");
    toast(bill ? "Vendor bill updated" : "Vendor bill added", "success");
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
          <h2 className="text-lg font-semibold">{bill ? "Edit Vendor Bill" : "New Vendor Bill"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <CustomDatePicker value={form.txn_date} onChange={(v) => setField("txn_date", v)} />
          </Field>
          <Field label="Site">
            <CustomSelect
              value={form.project_id}
              onChange={(v) => setField("project_id", v)}
              options={[{ label: "Select site", value: "" }, ...projects.map((p) => ({ label: p.name, value: String(p.id) }))]}
              placeholder="Select site"
            />
          </Field>
          <Field label="Amount">
            <Input
              autoFocus
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setField("amount", sanitizeAmount(e.target.value))}
              placeholder="0"
            />
          </Field>
          <Field label="GST %">
            <Input
              inputMode="decimal"
              value={form.gst_pct}
              onChange={(e) => setField("gst_pct", sanitizeAmount(e.target.value))}
              placeholder="0"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {GST_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setField("gst_pct", p)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    form.gst_pct === p ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </Field>
          <div className="col-span-2">
            <Field label="Vendor (optional)">
              <PaidToPicker value={form.paid_to} onChange={(v) => setField("paid_to", v)} />
            </Field>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-sm font-medium text-foreground">Head (optional)</p>
          <CategoryPicker value={form.category_id} onChange={(id) => setField("category_id", String(id))} />
        </div>

        <div className="mt-3">
          <Field label="Note (optional)">
            <Input value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Invoice / bill details" />
          </Field>
        </div>

        {/* Live preview of the total owed. */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
          <Row label="Amount" value={num(form.amount)} />
          <Row label={`GST @ ${num(form.gst_pct)}%`} value={gstAmount} />
          <Row label="Total Bill" value={totalBill} bold />
        </div>

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={submit} loading={saving} className="mt-5 w-full !py-3 text-base">
          {bill ? "Save Changes" : "Add Bill"}
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
