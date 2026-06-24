"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import {
  CATEGORIES,
  CATEGORY_ICON,
  inr,
  ACCOUNT_TYPE_LABELS,
  TYPE_LABELS,
  todayISO,
  sanitizeAmount,
} from "@/lib/format";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Project = { id: number; name: string };

const TYPES = ["expense", "transfer", "income", "partner_withdrawal"];

function blank() {
  return {
    type: "expense",
    txn_date: todayISO(),
    amount: "",
    category: "",
    source_account_id: "",
    dest_account_id: "",
    project_id: "",
    dest: "",
    paidFrom: "",
    paid_to: "",
    note: "",
  };
}

export default function TransactionForm({
  open,
  onClose,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  preset?: { type?: string; projectId?: number };
}) {
  const { toast } = useUI();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [f, setF] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    const init = blank();
    if (preset?.type) init.type = preset.type;
    if (preset?.projectId) {
      init.paidFrom = `proj:${preset.projectId}`;
      init.dest = `proj:${preset.projectId}`;
      init.project_id = String(preset.projectId);
    }
    setF(init);
    setErr("");
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }, [open, preset?.type, preset?.projectId]);

  if (!open) return null;

  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const banks = accounts.filter((a) => a.account_type !== "partner");
  const partners = accounts.filter((a) => a.account_type === "partner");
  // Only accounts with money can be a source for transfers / partner withdrawals.
  const fundedBanks = banks.filter((a) => a.current_balance > 0);
  const fundedPartners = partners.filter((a) => a.current_balance > 0);

  // Money-out limit: expenses, transfers and partner withdrawals can't exceed the source account balance.
  const amt = Number(f.amount) || 0;
  const sourceAcctId =
    f.type === "expense"
      ? f.paidFrom.startsWith("acc:")
        ? f.paidFrom.slice(4)
        : ""
      : f.type === "transfer" || f.type === "partner_withdrawal"
      ? f.source_account_id
      : "";
  const sourceAcct = sourceAcctId ? accounts.find((a) => String(a.id) === sourceAcctId) : undefined;
  const overBudget = !!sourceAcct && amt > 0 && amt > sourceAcct.current_balance;

  function decode(v: string) {
    if (v.startsWith("acc:")) return { dest_account_id: v.slice(4), project_id: "" };
    if (v.startsWith("proj:")) return { dest_account_id: "", project_id: v.slice(5) };
    return { dest_account_id: "", project_id: "" };
  }

  async function save() {
    setErr("");
    const payload: any = {
      type: f.type,
      txn_date: f.txn_date,
      amount: f.amount,
      note: f.note,
      paid_to: f.paid_to,
    };

    if (f.type === "expense") {
      const d = decode(f.paidFrom);
      payload.category = f.category;
      payload.source_account_id = d.dest_account_id;
      payload.project_id = d.project_id;
    } else if (f.type === "transfer" || f.type === "income") {
      const d = decode(f.dest);
      payload.source_account_id = f.type === "transfer" ? f.source_account_id : "";
      payload.dest_account_id = d.dest_account_id;
      payload.project_id = d.project_id;
    } else if (f.type === "partner_contribution") {
      payload.source_account_id = f.source_account_id;
      payload.dest_account_id = f.dest_account_id;
    } else if (f.type === "partner_withdrawal") {
      payload.source_account_id = f.source_account_id;
      payload.dest_account_id = f.dest_account_id;
    }

    if (!payload.amount || Number(payload.amount) <= 0) return setErr("Enter a valid amount");
    if (f.type === "expense" && !f.category) return setErr("Select a category");
    if (sourceAcct && amt > sourceAcct.current_balance)
      return setErr(`Insufficient balance — ${sourceAcct.name} has only ${inr(sourceAcct.current_balance)} available`);

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).error || "Something went wrong");
    toast("Transaction saved", "success");
    window.dispatchEvent(new CustomEvent("txn:created"));
    onClose();
  }

  const accOpt = (a: Account) => (
    <option key={a.id} value={a.id}>
      {a.name} ({inr(a.current_balance)})
    </option>
  );
  // Accounts only (no sites). `excludeId` hides one account — used so a transfer's
  // destination can't be the same account chosen as the source. `includePartners` adds
  // partner accounts (used for Fund Transfer, where partners can send/receive money).
  const accountOptions = (excludeId?: string, includePartners = false) => {
    const opt = (a: Account) => (
      <option key={`a${a.id}`} value={`acc:${a.id}`}>
        {a.name} ({ACCOUNT_TYPE_LABELS[a.account_type]}) · {inr(a.current_balance)}
      </option>
    );
    return (
      <>
        <optgroup label="Accounts">{banks.filter((a) => String(a.id) !== excludeId).map(opt)}</optgroup>
        {includePartners && partners.length > 0 && (
          <optgroup label="Partners">{partners.filter((a) => String(a.id) !== excludeId).map(opt)}</optgroup>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 animate-fade-in sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">New Transaction</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Type selector */}
        <div className="mb-4 flex flex-wrap gap-2">
          {TYPES.map((tp) => (
            <button
              key={tp}
              onClick={() => set({ ...blank(), type: tp, txn_date: f.txn_date })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                f.type === tp ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
              }`}
            >
              {TYPE_LABELS[tp]}
            </button>
          ))}
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Amount</label>
            <Input
              autoFocus
              type="text"
              inputMode="decimal"
              value={f.amount}
              onChange={(e) => set({ amount: sanitizeAmount(e.target.value) })}
              placeholder="0"
              className={`!py-3 !text-2xl !font-bold ${overBudget ? "!border-danger !ring-danger/20" : ""}`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</label>
            <Input type="date" max={todayISO()} value={f.txn_date} onChange={(e) => set({ txn_date: e.target.value })} className="!py-3" />
          </div>
        </div>

        {/* Category chips */}
        {f.type === "expense" && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                const active = f.category === c;
                return (
                  <button
                    key={c}
                    onClick={() => set({ category: c })}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                      active ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {f.type === "expense" && (
            <Labeled label="Paid From (account)">
              <Select value={f.paidFrom} onChange={(e) => set({ paidFrom: e.target.value })}>
                <option value="">Select…</option>
                {accountOptions()}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                To record a site expense, use “Record Expense” instead.
              </p>
            </Labeled>
          )}

          {f.type === "transfer" && (
            <>
              <Labeled label="Source Account">
                <Select
                  value={f.source_account_id}
                  onChange={(e) => {
                    const src = e.target.value;
                    // Drop the destination if it's now the same account as the source.
                    set({ source_account_id: src, dest: f.dest === `acc:${src}` ? "" : f.dest });
                  }}
                >
                  <option value="">Select…</option>
                  <optgroup label="Accounts">{fundedBanks.map(accOpt)}</optgroup>
                  {fundedPartners.length > 0 && (
                    <optgroup label="Partners">{fundedPartners.map(accOpt)}</optgroup>
                  )}
                </Select>
              </Labeled>
              <Labeled label="Destination Account">
                <Select value={f.dest} onChange={(e) => set({ dest: e.target.value })}>
                  <option value="">Select…</option>
                  {accountOptions(f.source_account_id, true)}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  To send money to a site, use “Allocate Funds” instead.
                </p>
              </Labeled>
            </>
          )}

          {f.type === "income" && (
            <Labeled label="Received Into (account)">
              <Select value={f.dest} onChange={(e) => set({ dest: e.target.value })}>
                <option value="">Select…</option>
                {accountOptions()}
              </Select>
            </Labeled>
          )}

          {f.type === "partner_withdrawal" && (
            <>
              <Labeled label="From Account (bank/cash)">
                <Select value={f.source_account_id} onChange={(e) => set({ source_account_id: e.target.value })}>
                  <option value="">Select…</option>
                  {fundedBanks.map(accOpt)}
                </Select>
              </Labeled>
              <Labeled label="Partner">
                <Select value={f.dest_account_id} onChange={(e) => set({ dest_account_id: e.target.value })}>
                  <option value="">Select partner…</option>
                  {partners.map(accOpt)}
                </Select>
              </Labeled>
            </>
          )}

          <Labeled label={f.type === "income" ? "Income From (optional)" : "Paid To (optional)"}>
            <Input
              value={f.paid_to}
              onChange={(e) => set({ paid_to: e.target.value })}
              placeholder={f.type === "income" ? "e.g. Flat booking, Rent, Land sale" : "e.g. Ramesh Contractor"}
            />
          </Labeled>
        </div>

        {/* Note */}
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Note (optional)</label>
          <Input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Short description" />
        </div>

        {overBudget && sourceAcct && (
          <p className="mt-3 text-xs font-medium text-danger">
            Insufficient balance — only {inr(sourceAcct.current_balance)} available in {sourceAcct.name}.
          </p>
        )}

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <Button onClick={save} loading={saving} disabled={overBudget} className="mt-5 w-full !py-3 text-base">
          {saving ? "Saving…" : "Save Transaction"}
        </Button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
