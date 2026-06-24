"use client";
import { useEffect, useRef, useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, todayISO, sanitizeAmount, ACCOUNT_TYPE_LABELS } from "@/lib/format";
import CategoryPicker from "@/components/CategoryPicker";

type Project = { id: number; name: string; balance: number };
type Account = { id: number; name: string; account_type: string; current_balance: number };

const LAST_SITE_KEY = "lastSiteId";

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
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  // "site" = pay from the site's allocated funds; "acc:<id>" = pay directly from a bank/cash account.
  const [payFrom, setPayFrom] = useState("site");
  const [date, setDate] = useState(todayISO());
  const [paidTo, setPaidTo] = useState("");
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setCategory("");
    setPayFrom("site");
    setDate(todayISO());
    setPaidTo("");
    setNote("");
    setShowMore(false);
    setErr("");
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
      .then((j) => setAccounts((j.data as Account[]).filter((a) => a.current_balance > 0)));
  }, [open, presetProjectId]);

  if (!open) return null;

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
    if (!category) return setErr("Select a category");
    if (!projectId) return setErr("Select a site");
    if (!fromSite && !sourceAccount) return setErr("Select where the money is paid from");
    if (Number(amount) > available)
      return setErr(
        fromSite
          ? `Insufficient funds — ${sourceName} has only ${inr(available)} available. Allocate more funds first.`
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
        category,
        amount,
        txn_date: date,
        paid_to: paidTo,
        note,
      }),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");

    if (typeof window !== "undefined") localStorage.setItem(LAST_SITE_KEY, projectId);
    window.dispatchEvent(new CustomEvent("txn:created"));
    toast("Expense recorded", "success");

    if (addAnother) {
      setAmount("");
      setCategory("");
      setPaidTo("");
      setNote("");
      amountRef.current?.focus();
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {presetProjectId && selectedSite ? `Record Expense · ${selectedSite.name}` : "Record Expense"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Amount */}
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Amount</label>
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
        {overBudget && (
          <p className="mt-1.5 text-xs font-medium text-danger">
            {fromSite ? "Insufficient funds" : "Insufficient balance"} — only {inr(available)} available in {sourceName}.
          </p>
        )}

        {/* Category chips */}
        <p className="mb-1.5 mt-4 text-sm font-medium text-muted-foreground">Category</p>
        <CategoryPicker value={category} onChange={setCategory} />

        {/* Site */}
        <p className="mb-1.5 mt-4 text-sm font-medium text-muted-foreground">Site</p>
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
        <p className="mb-1.5 mt-4 text-sm font-medium text-muted-foreground">Paid From</p>
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
            {
              group: "Direct from account",
              items: accounts.map((a) => ({
                label: `${a.name} · ${ACCOUNT_TYPE_LABELS[a.account_type]} (${inr(a.current_balance)})`,
                value: `acc:${a.id}`
              }))
            }
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</label>
              <CustomDatePicker value={date} onChange={(val) => setDate(val)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Paid To</label>
              <Input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="e.g. Ramesh Contractor" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Note</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short description" />
            </div>
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
