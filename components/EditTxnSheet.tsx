"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, CustomDatePicker } from "@/components/ui";
import CategoryPicker from "@/components/CategoryPicker";
import PaidToPicker from "@/components/PaidToPicker";
import { useUI } from "@/components/UIProvider";
import { inr, todayISO, TYPE_LABELS } from "@/lib/format";

// Edit a transaction's NON-financial fields only — date, paid-to, note, and (for expenses)
// the Head/Type-of-Head. Amount, type, and accounts are immutable here (changing them would
// move money); the server PUT enforces the same. To change those, delete and re-create.
export default function EditTxnSheet({
  open,
  txn,
  onClose,
}: {
  open: boolean;
  txn: any | null;
  onClose: () => void;
}) {
  const { toast } = useUI();
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState<number | string>("");
  const [paidTo, setPaidTo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !txn) return;
    // txn_date may arrive as a full ISO timestamp; the date picker needs plain YYYY-MM-DD.
    setDate(txn.txn_date ? String(txn.txn_date).slice(0, 10) : todayISO());
    setCategoryId(txn.category_id ?? "");
    setPaidTo(txn.paid_to || "");
    setNote(txn.note || "");
    setErr("");
  }, [open, txn]);

  if (!open || !txn) return null;

  const isExpense = txn.type === "expense";

  async function submit() {
    setErr("");
    if (!date) return setErr("Pick a date");

    setSaving(true);
    const res = await fetch(`/api/transactions/${txn.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txn_date: date,
        category_id: isExpense && categoryId ? Number(categoryId) : null,
        paid_to: paidTo || null,
        note: note || null,
      }),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");

    window.dispatchEvent(new CustomEvent("txn:created"));
    toast("Transaction updated", "success");
    onClose();
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
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit {TYPE_LABELS[txn.type] || "transaction"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {inr(txn.amount)} · amount &amp; accounts can&rsquo;t be edited — delete and re-create to change those.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</label>
            <CustomDatePicker value={date} onChange={(val) => setDate(val)} />
          </div>

          {isExpense && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Paid To (optional)</label>
              <PaidToPicker value={paidTo} onChange={setPaidTo} placeholder="Select or add a payee" />
            </div>
          )}

          {isExpense && (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Head</label>
              <CategoryPicker value={categoryId} onChange={(id) => setCategoryId(id)} />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Note (optional)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short description" />
          </div>
        </div>

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={submit} loading={saving} className="mt-5 w-full !py-3 text-base">
          Save changes
        </Button>
      </div>
    </div>
  );
}
