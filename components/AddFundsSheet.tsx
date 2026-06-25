"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, CustomDatePicker } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, todayISO, sanitizeAmount } from "@/lib/format";

type Account = { id: number; name: string; account_type: string; current_balance: number };

export default function AddFundsSheet({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
}) {
  const { toast } = useUI();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDate(todayISO());
    setNote("");
    setErr("");
  }, [open, account?.id, account?.account_type]);

  if (!open || !account) return null;

  async function submit() {
    setErr("");
    if (!amount || Number(amount) <= 0) return setErr("Enter a valid amount");

    // Money is added straight into this account, whatever its type.
    const payload: any = {
      type: "income",
      dest_account_id: account!.id,
      amount,
      txn_date: date,
      note,
    };

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");

    window.dispatchEvent(new CustomEvent("txn:created"));
    toast(`Added ${inr(Number(amount))} to ${account!.name}`, "success");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Money to {account.name}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Adds money directly to this account</p>

        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Amount</label>
        <Input
          autoFocus
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
          placeholder="0"
          className="!py-3 !text-3xl !font-bold"
        />

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</label>
          <CustomDatePicker value={date} onChange={(val) => setDate(val)} />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Note (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short description" />
        </div>

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={submit} loading={saving} className="mt-5 w-full !py-3 text-base">
          Add Money
        </Button>
      </div>
    </div>
  );
}
