"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker, Field } from "@/components/ui";
import PaidToPicker from "@/components/PaidToPicker";
import CategoryPicker from "@/components/CategoryPicker";
import { useUI } from "@/components/UIProvider";
import { inr, sanitizeAmount, ACCOUNT_TYPE_LABELS } from "@/lib/format";

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
  payment_type: "normal" | "advance";
  paid: number; // total paid via payments
  advance?: number; // the first payment (the up-front advance, for advance-type bills)
  payment_count?: number; // number of payments (installments) recorded
};

type Project = { id: number; name: string; balance?: number };
type Account = { id: number; name: string; account_type: string; current_balance: number };

// advance_amount / advance_from capture an optional first payment made when the bill is
// created (advance_from = "" → Site funds, else an account id).
const blank = { txn_date: "", project_id: "", category_id: "", paid_to: "", amount: "", gst_pct: "", note: "", advance_amount: "", advance_from: "" };
const GST_PRESETS = ["0", "5", "12", "18", "28"];

export default function VendorBillSheet({
  open,
  bill,
  onClose,
  onSaved,
  defaultProjectId,
}: {
  open: boolean;
  bill: VendorBill | null; // null = create, set = edit 
  onClose: () => void;
  onSaved: () => void;
  defaultProjectId?: number | null; // preselect + lock this site on create (from a site page)
}) {
  const { toast } = useUI();
  const [form, setForm] = useState({ ...blank });
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data ?? []));
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data ?? []));
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
            advance_amount: "",
            advance_from: "",
          }
        : { ...blank, project_id: defaultProjectId ? String(defaultProjectId) : "" }
    );
  }, [open, bill, defaultProjectId]);

  if (!open) return null;

  const num = (v: string) => Number(v) || 0;
  // GST is entered as a percentage; the rupee amount is derived (rounded to paise).
  const gstAmount = Math.round(num(form.amount) * num(form.gst_pct)) / 100;
  const totalBill = num(form.amount) + gstAmount;
  // The advance paid up front (create only) can't exceed the total bill.
  const advanceOver = !bill && num(form.advance_amount) > totalBill;

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // "Paid From" for the advance: Site funds or an account, grouped by Bank/Cash/Partner with
  // balances — mirrors VendorPaymentsSheet. Only sources holding money are listed (a ₹0
  // balance can't fund a payment), but the current selection is always kept.
  const siteBalance = projects.find((p) => String(p.id) === form.project_id)?.balance;
  const accountOptions = [
    { label: siteBalance != null ? `Site funds · ${inr(siteBalance)}` : "Site funds", value: "" },
    ...(["bank", "cash", "partner"] as const)
      .map((t) => ({
        group: ACCOUNT_TYPE_LABELS[t],
        items: accounts
          .filter((a) => a.account_type === t)
          .filter((a) => Number(a.current_balance) > 0 || String(a.id) === form.advance_from)
          .map((a) => ({ label: `${a.name} · ${inr(Number(a.current_balance))}`, value: String(a.id) })),
      }))
      .filter((g) => g.items.length > 0),
  ];

  async function submit() {
    setErr("");
    if (!form.txn_date) return setErr("Please select a date");
    if (!form.project_id) return setErr("Please select a site");
    if (!form.amount || Number(form.amount) <= 0) return setErr("Enter a valid amount");
    // Optional advance paid at creation — must not exceed the total bill.
    const advance = num(form.advance_amount);
    if (!bill && advance > 0 && advance > totalBill) {
      return setErr("Advance can't be more than the total bill");
    }
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
      // An advance paid at creation marks the bill as an advance; otherwise a normal bill.
      payment_type: bill ? bill.payment_type : advance > 0 ? "advance" : "normal",
    };
    setSaving(true);
    const res = await fetch(bill ? `/api/vendor-bills/${bill.id}` : "/api/vendor-bills", {
      method: bill ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSaving(false);
      return setErr((await res.json()).message || "Something went wrong");
    }
    // On create, record the advance as a real first payment so balances stay correct.
    if (!bill && advance > 0) {
      const newId = (await res.json())?.data?.id;
      if (newId) {
        const pay = await fetch(`/api/vendor-bills/${newId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txn_date: form.txn_date,
            amount: form.advance_amount,
            account_id: form.advance_from ? Number(form.advance_from) : null,
            category_id: form.category_id || null,
            note: form.note || null,
          }),
        });
        if (!pay.ok) {
          setSaving(false);
          return setErr(
            "Bill saved, but the advance payment failed: " + ((await pay.json()).message || "unknown error")
          );
        }
        // Sync the bill status from what was actually paid (partial vs paid-in-full).
        const desired = advance >= totalBill ? "complete" : "partial";
        await fetch(`/api/vendor-bills/${newId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: desired }),
        });
      }
    }
    setSaving(false);
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
          <Field label="Date" required>
            <CustomDatePicker value={form.txn_date} onChange={(v) => setField("txn_date", v)} />
          </Field>
          <Field label="Site" required>
            <CustomSelect
              value={form.project_id}
              onChange={(v) => setField("project_id", v)}
              options={[{ label: "Select site", value: "" }, ...projects.map((p) => ({ label: p.name, value: String(p.id) }))]}
              placeholder="Select site"
              // Locked to the current site when opened from a site page (create only).
              disabled={!bill && defaultProjectId != null}
            />
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

        {/* Advance paid now — only on create. Posts a real first payment so balances stay
            correct. Leave the amount blank for a plain unpaid bill. */}
        {!bill && (
          <div className="mt-3 rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Advance paid now (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Advance amount">
                <Input
                  inputMode="decimal"
                  value={form.advance_amount}
                  onChange={(e) => setField("advance_amount", sanitizeAmount(e.target.value))}
                  placeholder="0"
                  className={advanceOver ? "!border-danger !ring-danger/20" : ""}
                />
                {advanceOver && (
                  <p className="mt-1 text-xs text-danger">Can't be more than the Total Bill ({inr(totalBill)}).</p>
                )}
              </Field>
              <Field label="Paid from">
                <CustomSelect
                  value={form.advance_from}
                  onChange={(v) => setField("advance_from", v)}
                  options={accountOptions}
                  placeholder="Site funds"
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pay part of the bill up front. Leave blank for an unpaid bill. When the final bill arrives, edit this bill
              and raise the amount to the full total — the balance reopens as Partially Paid.
            </p>
          </div>
        )}

        {/* Live preview of the total owed. */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="col-span-2 flex items-center justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{inr(num(form.amount))}</span>
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <span className="text-muted-foreground">+ GST @ {num(form.gst_pct)}%</span>
            <span className="font-medium text-success">+ {inr(gstAmount)}</span>
          </div>
          <div className="col-span-2 flex items-center justify-between border-t border-border pt-1.5">
            <span className="font-semibold">Total Bill</span>
            <span className="font-bold">{inr(totalBill)}</span>
          </div>
          {!bill && num(form.advance_amount) > 0 && (
            <>
              <div className="col-span-2 flex items-center justify-between">
                <span className="text-muted-foreground">− Advance paid now</span>
                <span className="font-medium text-danger">− {inr(num(form.advance_amount))}</span>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-border pt-1.5">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold">{inr(totalBill - num(form.advance_amount))}</span>
              </div>
            </>
          )}
        </div>

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={submit} loading={saving} disabled={advanceOver} className="mt-5 w-full !py-3 text-base">
          {bill ? "Save Changes" : "Add Bill"}
        </Button>
      </div>
    </div>
  );
}
