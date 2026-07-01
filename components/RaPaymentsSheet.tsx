"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker, Field, Label, Skeleton, EmptyState } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, formatDate, todayISO, sanitizeAmount, ACCOUNT_TYPE_LABELS } from "@/lib/format";
import type { RaReceipt } from "@/components/RaReceiptSheet";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Payment = {
  id: number;
  txn_date: string;
  amount: number;
  account_id: number | null;
  account_name: string | null;
  note: string | null;
};

const STATUS_LABEL: Record<string, string> = { pending: "Pending", partial: "Partially Paid", complete: "Complete" };
const STATUS_COLOR: Record<string, string> = { pending: "amber", partial: "blue", complete: "green" };

export default function RaPaymentsSheet({
  open,
  receipt,
  netReceivable,
  onClose,
  onChanged,
}: {
  open: boolean;
  receipt: RaReceipt | null;
  netReceivable: number;
  onClose: () => void;
  onChanged: () => void; // refresh the receipts list (paid totals)
}) {
  const { toast, confirm } = useUI();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<string>("pending");

  const load = useCallback(() => {
    if (!receipt) return;
    fetch(`/api/ra-receipts/${receipt.id}/payments`)
      .then((r) => r.json())
      .then((j) => setPayments(j.data ?? []));
  }, [receipt]);

  useEffect(() => {
    if (!open || !receipt) return;
    setPayments(null);
    setErr("");
    setDate(todayISO());
    setAmount("");
    setNote("");
    setAccountId(receipt.account_id ? String(receipt.account_id) : "");
    setStatus(receipt.status);
    load();
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data ?? []));
  }, [open, receipt, load]);

  const paid = useMemo(() => (payments ?? []).reduce((s, p) => s + Number(p.amount), 0), [payments]);
  const balance = netReceivable - paid;
  const paisa = (n: number) => Math.round(n * 100);
  const fullyPaid = payments !== null && paisa(paid) >= paisa(netReceivable) && paisa(netReceivable) > 0;
  const over = Number(amount) > 0 && paisa(Number(amount)) > paisa(balance);

  // Auto-set the bill status from what's actually been received: nothing → pending,
  // part → partial, full → complete. Persists via PATCH and refreshes the receipts list.
  useEffect(() => {
    if (!open || !receipt || payments === null) return;
    const desired = paisa(paid) <= 0 ? "pending" : paisa(paid) >= paisa(netReceivable) ? "complete" : "partial";
    if (desired === status) return;
    setStatus(desired);
    fetch(`/api/ra-receipts/${receipt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: desired }),
    }).then(() => onChanged());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, paid, netReceivable, open]);

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

  if (!open || !receipt) return null;

  async function addPayment() {
    setErr("");
    if (!date) return setErr("Select a date");
    const amt = Number(amount);
    if (!amount || amt <= 0) return setErr("Enter a valid amount");
    if (!accountId) return setErr("Select where the payment was received");
    if (balance <= 0) return setErr("This bill is already fully received.");
    if (amt > balance) return setErr(`Amount can't exceed the balance due (${inr(balance)}).`);
    setSaving(true);
    const res = await fetch(`/api/ra-receipts/${receipt!.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txn_date: date, amount, account_id: accountId || null, note: note || null }),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Could not add payment");
    setAmount("");
    setNote("");
    toast("Payment added", "success");
    window.dispatchEvent(new CustomEvent("txn:created")); // refresh balances / dashboard / bank
    load();
    onChanged();
  }

  async function del(p: Payment) {
    const okConfirm = await confirm({
      title: "Delete payment?",
      message: `${inr(p.amount)} received on ${formatDate(p.txn_date)} will be removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!okConfirm) return;
    const res = await fetch(`/api/ra-payments/${p.id}`, { method: "DELETE" });
    if (!res.ok) return toast((await res.json()).message || "Could not delete", "error");
    toast("Payment deleted", "success");
    window.dispatchEvent(new CustomEvent("txn:created"));
    load();
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payments</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {receipt.project_name || "—"}
          {receipt.paid_to ? ` · ${receipt.paid_to}` : ""} ·{" "}
          <Label color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Label>
        </p>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Net Receivable</p>
            <p className="font-semibold">{inr(netReceivable)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Received</p>
            <p className="font-semibold text-success">{inr(paid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className={`font-semibold ${balance > 0 ? "text-danger" : ""}`}>{inr(balance)}</p>
          </div>
        </div>

        {/* Payment list */}
        <div className="mt-4 space-y-2">
          {!payments ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : payments.length === 0 ? (
            <EmptyState>No payments recorded yet.</EmptyState>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{inr(p.amount)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(p.txn_date)}
                    {p.account_name ? ` · ${p.account_name}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <Button variant="danger" onClick={() => del(p)} className="!px-2">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add payment — locked once the bill is fully received. */}
        <div className="mt-5 border-t border-border pt-4">
          {fullyPaid ? (
            <p className="rounded-lg bg-success/10 p-3 text-center text-sm font-medium text-success">
              ✓ This bill is fully received.
            </p>
          ) : (
          <>
          <p className="mb-2 text-sm font-semibold">Record a payment</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <CustomDatePicker value={date} onChange={setDate} />
            </Field>
            <Field label="Amount" required>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
                placeholder="0"
                className={over ? "!border-danger !ring-danger/20" : ""}
              />
              {over && <p className="mt-1 text-xs text-danger">Max {inr(balance)} (balance due)</p>}
            </Field>
            <div className="col-span-2">
              <Field label="Received In" required>
                <CustomSelect
                  value={accountId}
                  onChange={setAccountId}
                  onClear={() => setAccountId("")}
                  options={accountOptions}
                  placeholder="Bank / Cash / Partner"
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Note (optional)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cheque no. / reference" />
              </Field>
            </div>
          </div>
          {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}
          <Button onClick={addPayment} loading={saving} disabled={over || balance <= 0 || !accountId} className="mt-4 w-full">
            <Plus className="h-4 w-4" /> Add Payment
          </Button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
