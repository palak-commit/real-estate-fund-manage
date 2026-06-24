"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
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
  const [banks, setBanks] = useState<Account[]>([]);
  const [amount, setAmount] = useState("");
  const [depositInto, setDepositInto] = useState("");
  const [from, setFrom] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const isPartner = account?.account_type === "partner";

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDepositInto("");
    setFrom("");
    setDate(todayISO());
    setNote("");
    setErr("");
    if (account?.account_type === "partner") {
      fetch("/api/accounts").then((r) => r.json()).then((as: Account[]) => {
        const b = as.filter((a) => a.account_type !== "partner");
        setBanks(b);
        setDepositInto(b[0] ? String(b[0].id) : "");
      });
    }
  }, [open, account?.id, account?.account_type]);

  if (!open || !account) return null;

  async function submit() {
    setErr("");
    if (!amount || Number(amount) <= 0) return setErr("Enter a valid amount");

    const payload: any = { amount, txn_date: date, note };
    if (isPartner) {
      if (!depositInto) return setErr("Select where the money was deposited");
      payload.type = "partner_contribution";
      payload.source_account_id = account!.id; // partner
      payload.dest_account_id = depositInto; // bank/cash
    } else {
      payload.type = "income";
      payload.dest_account_id = account!.id;
      payload.paid_to = from; // "received from"
    }

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).error || "Something went wrong");

    window.dispatchEvent(new CustomEvent("txn:created"));
    toast(`Added ${inr(Number(amount))} to ${account!.name}`, "success");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Funds to {account.name}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {isPartner ? "Records a partner contribution" : "Records income into this account"}
        </p>

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

        {isPartner ? (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Deposited Into (bank/cash)</label>
            <Select value={depositInto} onChange={(e) => setDepositInto(e.target.value)} disabled={banks.length === 0}>
              <option value="">Select…</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({inr(b.current_balance)})
                </option>
              ))}
            </Select>
            {banks.length === 0 && (
              <p className="mt-1 text-xs text-warning">Add a bank or cash account first.</p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Received From (optional)</label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="e.g. Flat booking, deposit" />
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</label>
          <Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Note (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short description" />
        </div>

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={submit} loading={saving} className="mt-5 w-full !py-3 text-base">
          Add Funds
        </Button>
      </div>
    </div>
  );
}
