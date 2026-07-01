"use client";
import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, RotateCcw } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker, Field } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, todayISO, sanitizeAmount, ACCOUNT_TYPE_LABELS } from "@/lib/format";
import CategoryPicker from "@/components/CategoryPicker";
import PaidToPicker from "@/components/PaidToPicker";

type Project = { id: number; name: string; balance: number };
type Account = { id: number; name: string; account_type: string; current_balance: number };

const LAST_SITE_KEY = "lastSiteId";
const LAST_PAYFROM_KEY = "lastPayFrom";
const LAST_EXPENSE_KEY = "lastExpense";

// A snapshot of the previous expense, used by the "Repeat last" shortcut.
type LastExpense = {
  amount: string;
  categoryId: number | "";
  categoryLabel?: string;
  projectId: string;
  payFrom: string;
  paidTo: string;
  note: string;
};

export default function QuickExpenseSheet({
  open,
  onClose,
  presetProjectId,
}: {
  open: boolean;
  onClose: () => void;
  presetProjectId?: number;
}) {
  const { toast } = useUI();
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [projectId, setProjectId] = useState("");
  // "site" = pay from the site's allocated funds; "acc:<id>" = pay directly from a bank/cash account.
  const [payFrom, setPayFrom] = useState("site");
  const [date, setDate] = useState(todayISO());
  const [paidTo, setPaidTo] = useState("");
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [lastExpense, setLastExpense] = useState<LastExpense | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setCategoryId("");
    setPayFrom("site");
    setDate(todayISO());
    setPaidTo("");
    setNote("");
    setShowMore(false);
    setErr("");
    // Load the previous expense snapshot for the "Repeat last" shortcut.
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LAST_EXPENSE_KEY) : null;
      setLastExpense(raw ? (JSON.parse(raw) as LastExpense) : null);
    } catch {
      setLastExpense(null);
    }
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => {
        const ps: Project[] = j.data;
        setProjects(ps);
        const last = typeof window !== "undefined" ? localStorage.getItem(LAST_SITE_KEY) : null;
        const pick =
          presetProjectId?.toString() ||
          (last && ps.some((p) => String(p.id) === last) ? last : "") ||
          (ps[0] ? String(ps[0].id) : "");
        setProjectId(pick);
      });
    fetch("/api/accounts")
      .then((r) => r.json())
      // Any account with money (bank, cash or partner) can directly pay an expense.
      .then((j) => {
        const accs = (j.data as Account[]).filter((a) => a.current_balance > 0);
        setAccounts(accs);
        // Restore the last-used funding source (site funds, or a still-valid account) so the
        // owner doesn't re-pick it every time.
        const lastPay = typeof window !== "undefined" ? localStorage.getItem(LAST_PAYFROM_KEY) : null;
        if (lastPay === "site") setPayFrom("site");
        else if (lastPay && accs.some((a) => `acc:${a.id}` === lastPay)) setPayFrom(lastPay);
      });
  }, [open, presetProjectId]);

  if (!open) return null;

  // Prefill the form from the previous expense (amount, head, site, funding, paid-to, note),
  // leaving the user to confirm or tweak before saving.
  function repeatLast() {
    if (!lastExpense) return;
    setAmount(lastExpense.amount || "");
    setCategoryId(lastExpense.categoryId ?? "");
    setPaidTo(lastExpense.paidTo || "");
    setNote(lastExpense.note || "");
    if (!presetProjectId && lastExpense.projectId && projects.some((p) => String(p.id) === lastExpense.projectId))
      setProjectId(lastExpense.projectId);
    if (lastExpense.payFrom === "site" || accounts.some((a) => `acc:${a.id}` === lastExpense.payFrom))
      setPayFrom(lastExpense.payFrom);
    if (lastExpense.note || lastExpense.paidTo) setShowMore(true);
    amountRef.current?.focus();
  }

  const selectedSite = projects.find((p) => String(p.id) === projectId);
  const fromSite = payFrom === "site";
  const sourceAccount = !fromSite ? accounts.find((a) => `acc:${a.id}` === payFrom) : undefined;
  // Available balance depends on the funding source.
  const available = fromSite ? selectedSite?.balance ?? 0 : sourceAccount?.current_balance ?? 0;
  const sourceName = fromSite ? selectedSite?.name ?? "site" : sourceAccount?.name ?? "account";
  const overBudget = Number(amount) > 0 && Number(amount) > available;

  async function submit(addAnother: boolean) {
    setErr("");
    if (!amount || Number(amount) <= 0) return setErr("Enter a valid amount");
    if (!categoryId) return setErr("Select a category (Head)");
    if (!projectId) return setErr("Select a site");
    if (!fromSite && !sourceAccount) return setErr("Select where the money is paid from");
    if (Number(amount) > available)
      return setErr(
        fromSite
          ? `Insufficient funds — ${sourceName} has only ${inr(available)} available. Add funds to the site first.`
          : `Insufficient balance — ${sourceName} has only ${inr(available)} available.`
      );

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        project_id: projectId,
        source_account_id: fromSite ? "" : String(sourceAccount!.id),
        category_id: categoryId,
        amount,
        txn_date: date,
        paid_to: paidTo,
        note,
      }),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");

    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_SITE_KEY, projectId);
      localStorage.setItem(LAST_PAYFROM_KEY, payFrom);
      const snapshot: LastExpense = { amount, categoryId, projectId, payFrom, paidTo, note };
      localStorage.setItem(LAST_EXPENSE_KEY, JSON.stringify(snapshot));
    }
    window.dispatchEvent(new CustomEvent("txn:created"));
    toast("Expense recorded", "success");

    if (addAnother) {
      setAmount("");
      setCategoryId("");
      setPaidTo("");
      setNote("");
      amountRef.current?.focus();
    } else {
      onClose();
    }
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
          <h2 className="text-lg font-semibold">
            {presetProjectId && selectedSite ? `Record Expense · ${selectedSite.name}` : "Record Expense"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Repeat last expense */}
        {lastExpense && !amount && (
          <button
            onClick={repeatLast}
            className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Repeat last expense
            {lastExpense.amount ? ` (${inr(Number(lastExpense.amount))})` : ""}
          </button>
        )}

        {/* Amount */}
        <Field label="Amount" required>
          <Input
            ref={amountRef as any}
            autoFocus
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
            placeholder="0"
            className={`!py-3 !text-3xl !font-bold ${overBudget ? "!border-danger !ring-danger/20" : ""}`}
          />
        </Field>
        {overBudget && (
          <p className="mt-1.5 text-xs font-medium text-danger">
            {fromSite ? "Insufficient funds" : "Insufficient balance"} — only {inr(available)} available in {sourceName}.
          </p>
        )}

        {/* Category chips */}
        <p className="mb-1.5 mt-4 text-sm font-medium text-muted-foreground">Head <span className="text-danger">*</span></p>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />

        {/* Site */}
        <p className="mb-1.5 mt-4 text-sm font-medium text-muted-foreground">Site <span className="text-danger">*</span></p>
        <CustomSelect
          value={projectId}
          onChange={(val) => setProjectId(val)}
          disabled={!!presetProjectId}
          options={projects.map((p) => ({
            label: `${p.name} (${inr(p.balance)} available)`,
            value: String(p.id)
          }))}
          placeholder="Select site…"
        />
        {presetProjectId && (
          <p className="mt-1 text-xs text-muted-foreground">Locked to the selected site</p>
        )}

        {/* Paid From — site funds or a bank/cash account */}
        <p className="mb-1.5 mt-4 text-sm font-medium text-muted-foreground">Paid From <span className="text-danger">*</span></p>
        <CustomSelect
          value={payFrom}
          onChange={(val) => setPayFrom(val)}
          options={[
            {
              group: "Site funds",
              items: [
                {
                  label: selectedSite ? `${selectedSite.name} funds (${inr(selectedSite.balance)} available)` : "Site funds",
                  value: "site"
                }
              ]
            },
            // Direct-from-account, split into Bank / Cash / Partner groups.
            ...(["bank", "cash", "partner"] as const)
              .map((tp) => ({
                group: ACCOUNT_TYPE_LABELS[tp],
                items: accounts
                  .filter((a) => a.account_type === tp)
                  .map((a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: `acc:${a.id}` })),
              }))
              .filter((g) => g.items.length > 0)
          ]}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {fromSite
            ? "Deducted from the site's allocated funds."
            : `Paid directly from ${sourceName} — site funds stay untouched.`}
        </p>

        {/* More options */}
        <button
          onClick={() => setShowMore((v) => !v)}
          className="mt-4 flex items-center gap-1 text-sm font-medium text-primary"
        >
          <ChevronDown className={`h-4 w-4 transition ${showMore ? "rotate-180" : ""}`} />
          {showMore ? "Fewer options" : "More options (date, paid to, note)"}
        </button>

        {showMore && (
          <div className="mt-3 space-y-3">
            <Field label="Date">
              <CustomDatePicker value={date} onChange={(val) => setDate(val)} />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted-foreground">Paid To</p>
              <PaidToPicker value={paidTo} onChange={setPaidTo} />
            </div>
            <Field label="Note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short description" />
            </Field>
          </div>
        )}

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        <div className="mt-5 flex gap-2">
          <Button variant="outline" onClick={() => submit(true)} disabled={saving || overBudget} className="flex-1">
            Save &amp; add another
          </Button>
          <Button onClick={() => submit(false)} loading={saving} disabled={overBudget} className="flex-1">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
