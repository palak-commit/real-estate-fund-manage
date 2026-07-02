"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker, Field, Label, Skeleton, EmptyState } from "@/components/ui";
import CategoryPicker from "@/components/CategoryPicker";
import { useUI } from "@/components/UIProvider";
import { inr, formatDate, todayISO, sanitizeAmount, ACCOUNT_TYPE_LABELS } from "@/lib/format";
import type { VendorBill } from "@/components/VendorBillSheet";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Payment = {
  id: number;
  txn_date: string;
  amount: number;
  account_id: number | null;
  account_name: string | null;
  category_id: number | null;
  note: string | null;
};

const STATUS_LABEL: Record<string, string> = { pending: "Pending", partial: "Partially Paid", complete: "Complete" };
const STATUS_COLOR: Record<string, string> = { pending: "amber", partial: "blue", complete: "green" };

export default function VendorPaymentsSheet({
  open,
  bill,
  totalBill,
  onClose,
  onChanged,
}: {
  open: boolean;
  bill: VendorBill | null;
  totalBill: number;
  onClose: () => void;
  onChanged: () => void; // refresh the bills list (paid totals)
}) {
  const { toast, confirm } = useUI();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(""); // "" = paid from site funds
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<string>("pending");
  const [siteBalance, setSiteBalance] = useState<number | null>(null); // for the "Site funds" option

  const load = useCallback(() => {
    if (!bill) return;
    fetch(`/api/vendor-bills/${bill.id}/payments`)
      .then((r) => r.json())
      .then((j) => setPayments(j.data ?? []));
  }, [bill]);

  useEffect(() => {
    if (!open || !bill) return;
    setPayments(null);
    setErr("");
    setDate(todayISO());
    setAmount("");
    setNote("");
    setAccountId(""); // default to Site funds; user picks an account to pay Direct
    setCategoryId(bill.category_id ? String(bill.category_id) : "");
    setStatus(bill.status);
    load();
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data ?? []));
    // Pull this site's available balance (received − site-funded spend) for the Site funds option.
    setSiteBalance(null);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => {
        const p = (j.data as any[])?.find((x) => x.id === bill.project_id);
        setSiteBalance(p ? Number(p.balance) : null);
      });
  }, [open, bill, load]);

  const paid = useMemo(() => (payments ?? []).reduce((s, p) => s + Number(p.amount), 0), [payments]);
  const balance = totalBill - paid;
  const paisa = (n: number) => Math.round(n * 100);
  const fullyPaid = payments !== null && paisa(paid) >= paisa(totalBill) && paisa(totalBill) > 0;
  const over = Number(amount) > 0 && paisa(Number(amount)) > paisa(balance);
  // Funds guard (mirrors the server): the chosen source — an account or the site's funds —
  // must hold enough for this payment.
  const selectedAccount = accountId ? accounts.find((a) => String(a.id) === accountId) ?? null : null;
  const fundsAvailable = accountId ? (selectedAccount ? Number(selectedAccount.current_balance) : null) : siteBalance;
  const fundsLabel = accountId ? selectedAccount?.name ?? "this account" : "site funds";
  const insufficient = Number(amount) > 0 && fundsAvailable != null && paisa(Number(amount)) > paisa(fundsAvailable);

  // Auto-set the bill status from what's actually been paid: nothing → pending,
  // part → partial, full → complete. Persists via PATCH and refreshes the bills list.
  useEffect(() => {
    if (!open || !bill || payments === null) return;
    const desired = paisa(paid) <= 0 ? "pending" : paisa(paid) >= paisa(totalBill) ? "complete" : "partial";
    if (desired === status) return;
    setStatus(desired);
    fetch(`/api/vendor-bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: desired }),
    }).then(() => onChanged());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, paid, totalBill, open]);

  // "Paid From": Site funds (no account → lowers site balance) or any account (Direct expense).
  // Only sources that actually hold money are listed — a ₹0 balance can't fund a payment
  // (the funds guard would block it anyway). The currently-selected source is always kept so
  // an in-progress selection never vanishes.
  const accountOptions = [
    ...(siteBalance == null || Number(siteBalance) > 0 || accountId === ""
      ? [{ label: siteBalance != null ? `Site funds · ${inr(siteBalance)}` : "Site funds", value: "" }]
      : []),
    ...(["bank", "cash", "partner"] as const)
      .map((t) => ({
        group: ACCOUNT_TYPE_LABELS[t],
        items: accounts
          .filter((a) => a.account_type === t)
          .filter((a) => Number(a.current_balance) > 0 || String(a.id) === accountId)
          .map((a) => ({ label: `${a.name} · ${inr(a.current_balance)}`, value: String(a.id) })),
      }))
      .filter((g) => g.items.length > 0),
  ];

  if (!open || !bill) return null;

  async function addPayment() {
    setErr("");
    if (!date) return setErr("Select a date");
    const amt = Number(amount);
    if (!amount || amt <= 0) return setErr("Enter a valid amount");
    if (balance <= 0) return setErr("This bill is already fully paid.");
    if (amt > balance) return setErr(`Amount can't exceed the balance due (${inr(balance)}).`);
    if (insufficient) return setErr(`Not enough money in ${fundsLabel} (${inr(fundsAvailable!)} available).`);
    setSaving(true);
    const res = await fetch(`/api/vendor-bills/${bill!.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txn_date: date,
        amount,
        account_id: accountId || null,
        category_id: categoryId || null,
        note: note || null,
      }),
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
      message: `${inr(p.amount)} paid on ${formatDate(p.txn_date)} will be removed and reversed from the account/site it was paid from.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!okConfirm) return;
    const res = await fetch(`/api/vendor-payments/${p.id}`, { method: "DELETE" });
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
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payments</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {bill.project_name || "—"}
          {bill.paid_to ? ` · ${bill.paid_to}` : ""} ·{" "}
          <Label color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Label>
        </p>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Total Bill</p>
            <p className="font-semibold">{inr(totalBill)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid</p>
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
            payments.map((p, i) => {
              // Payments are oldest-first. On an advance bill the first one is the up-front
              // advance; the rest are later installments.
              const isAdvance = bill?.payment_type === "advance" && i === 0;
              // Only tag installments when the bill was actually paid in more than one
              // instalment — a single, direct payment needs no "Installment 1" noise.
              const installmentCount = payments.length - (bill?.payment_type === "advance" ? 1 : 0);
              const label = isAdvance
                ? "Advance"
                : installmentCount > 1
                  ? `Installment ${bill?.payment_type === "advance" ? i : i + 1}`
                  : null;
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {inr(p.amount)}
                      {label && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            isAdvance ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {label}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(p.txn_date)}
                      {` · ${p.account_name || "Site funds"}`}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => del(p)} className="!px-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Add payment — locked once the bill is fully paid. */}
        <div className="mt-5 border-t border-border pt-4">
          {fullyPaid ? (
            <p className="rounded-lg bg-success/10 p-3 text-center text-sm font-medium text-success">
              ✓ This bill is fully paid.
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
                    className={over || insufficient ? "!border-danger !ring-danger/20" : ""}
                  />
                  {over ? (
                    <p className="mt-1 text-xs text-danger">Max {inr(balance)} (balance due)</p>
                  ) : insufficient ? (
                    <p className="mt-1 text-xs text-danger">
                      Only {inr(fundsAvailable!)} in {fundsLabel}
                    </p>
                  ) : null}
                </Field>
                <div className="col-span-2">
                  <Field label="Paid From">
                    <CustomSelect
                      value={accountId}
                      onChange={setAccountId}
                      options={accountOptions}
                      placeholder="Site funds"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {accountId
                        ? "Direct expense — money leaves this account, tagged to the site."
                        : "Paid from the site's own allocated funds."}
                    </p>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Note (optional)">
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cheque no. / reference" />
                  </Field>
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-sm font-medium text-foreground">Head (optional)</p>
                <CategoryPicker value={categoryId} onChange={(id) => setCategoryId(String(id))} />
              </div>

              {/* Step-wise effect of this payment on the balance due. */}
              {Number(amount) > 0 && !over && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Balance due</span>
                    <span className="font-medium">{inr(balance)}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-muted-foreground">− This payment</span>
                    <span className="font-medium text-danger">− {inr(Number(amount))}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between border-t border-border pt-1.5">
                    <span className="font-semibold">Remaining after</span>
                    <span className="font-bold">{inr(balance - Number(amount))}</span>
                  </div>
                </div>
              )}

              {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}
              <Button onClick={addPayment} loading={saving} disabled={over || insufficient || balance <= 0} className="mt-4 w-full">
                <Plus className="h-4 w-4" /> Add Payment
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
