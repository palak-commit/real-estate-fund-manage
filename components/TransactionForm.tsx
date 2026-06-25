"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, ACCOUNT_TYPE_LABELS, TYPE_LABELS, todayISO, sanitizeAmount } from "@/lib/format";
import CategoryPicker from "@/components/CategoryPicker";
import PaidToPicker from "@/components/PaidToPicker";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Project = { id: number; name: string; balance: number };

const TYPES = ["site_expense", "expense", "transfer", "partner_withdrawal"];
const labelFor = (tp: string) => (tp === "site_expense" ? "Site Expense" : TYPE_LABELS[tp]);

function blank() {
  return {
    type: "site_expense",
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
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data));
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data));
  }, [open, preset?.type, preset?.projectId]);

  if (!open) return null;

  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const banks = accounts.filter((a) => a.account_type !== "partner");
  const partners = accounts.filter((a) => a.account_type === "partner");
  // Only accounts with money can be a source for transfers / partner withdrawals.
  const fundedBanks = banks.filter((a) => a.current_balance > 0);
  const fundedPartners = partners.filter((a) => a.current_balance > 0);
  const fundedAll = accounts.filter((a) => a.current_balance > 0);

  // Site Expense: which site, and where it's paid from ("site" funds or "acc:<id>").
  const selectedSite = projects.find((p) => String(p.id) === f.project_id);
  const siteExpenseFrom = f.paidFrom || "site";

  // Money-out limit: a money-out source can't be exceeded.
  const amt = Number(f.amount) || 0;
  const sourceAcctId =
    f.type === "expense"
      ? f.paidFrom.startsWith("acc:")
        ? f.paidFrom.slice(4)
        : ""
      : f.type === "site_expense"
      ? siteExpenseFrom.startsWith("acc:")
        ? siteExpenseFrom.slice(4)
        : ""
      : f.type === "transfer" || f.type === "partner_withdrawal"
      ? f.source_account_id
      : "";
  const sourceAcct = sourceAcctId ? accounts.find((a) => String(a.id) === sourceAcctId) : undefined;
  // Over-budget when paying from an account, OR from site funds beyond the site's balance.
  const overSiteFunds =
    f.type === "site_expense" && siteExpenseFrom === "site" && !!selectedSite && amt > 0 && amt > selectedSite.balance;
  const overBudget = (!!sourceAcct && amt > 0 && amt > sourceAcct.current_balance) || overSiteFunds;

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

    if (f.type === "site_expense") {
      payload.type = "expense";
      payload.category = f.category;
      payload.project_id = f.project_id;
      payload.source_account_id = siteExpenseFrom === "site" ? "" : siteExpenseFrom.slice(4);
    } else if (f.type === "expense") {
      const d = decode(f.paidFrom);
      payload.category = f.category;
      payload.source_account_id = d.dest_account_id;
      payload.project_id = d.project_id;
    } else if (f.type === "transfer" || f.type === "income") {
      const d = decode(f.dest);
      payload.source_account_id = f.type === "transfer" ? f.source_account_id : "";
      payload.dest_account_id = d.dest_account_id;
      payload.project_id = d.project_id;
    } else if (f.type === "partner_withdrawal") {
      payload.source_account_id = f.source_account_id;
      payload.dest_account_id = f.dest_account_id;
    }

    if (!payload.amount || Number(payload.amount) <= 0) return setErr("Enter a valid amount");
    if ((f.type === "expense" || f.type === "site_expense") && !f.category) return setErr("Select a category");
    if (f.type === "site_expense" && !f.project_id) return setErr("Select a site");
    if (overSiteFunds && selectedSite)
      return setErr(`Insufficient site funds — ${selectedSite.name} has only ${inr(selectedSite.balance)} available`);
    if (sourceAcct && amt > sourceAcct.current_balance)
      return setErr(`Insufficient balance — ${sourceAcct.name} has only ${inr(sourceAcct.current_balance)} available`);

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");
    toast("Transaction saved", "success");
    window.dispatchEvent(new CustomEvent("txn:created"));
    onClose();
  }

  const accOpt = (a: Account) => ({
    label: `${a.name} (${inr(a.current_balance)})`,
    value: String(a.id),
  });
  // Accounts only (no sites). `excludeId` hides one account — used so a transfer's
  // destination can't be the same account chosen as the source. `includePartners` adds
  // partner accounts (used for Fund Transfer, where partners can send/receive money).
  const accountOptions = (excludeId?: string, includePartners = false) => {
    const opt = (a: Account) => ({
      label: `${a.name} (${ACCOUNT_TYPE_LABELS[a.account_type]}) · ${inr(a.current_balance)}`,
      value: `acc:${a.id}`,
    });
    
    const opts = [];
    const filteredBanks = banks.filter((a) => String(a.id) !== excludeId);
    if (filteredBanks.length > 0) {
      opts.push({ group: "Accounts", items: filteredBanks.map(opt) });
    }
    
    if (includePartners && partners.length > 0) {
      const filteredPartners = partners.filter((a) => String(a.id) !== excludeId);
      if (filteredPartners.length > 0) {
        opts.push({ group: "Partners", items: filteredPartners.map(opt) });
      }
    }

    return opts;
  };

  // Expense source: any FUNDED account (bank, cash or partner) with a balance > 0.
  const fundedSourceOptions = () => {
    const opt = (a: Account) => ({
      label: `${a.name} (${ACCOUNT_TYPE_LABELS[a.account_type]}) · ${inr(a.current_balance)}`,
      value: `acc:${a.id}`,
    });
    const opts: any[] = [];
    if (fundedBanks.length > 0) opts.push({ group: "Accounts", items: fundedBanks.map(opt) });
    if (fundedPartners.length > 0) opts.push({ group: "Partners", items: fundedPartners.map(opt) });
    return opts;
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
              {labelFor(tp)}
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
            <CustomDatePicker value={f.txn_date} onChange={(val) => set({ txn_date: val })} className="!w-full" align="right" />
          </div>
        </div>

        {/* Category chips */}
        {(f.type === "expense" || f.type === "site_expense") && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">Category</p>
            <CategoryPicker value={f.category} onChange={(c) => set({ category: c })} />
          </div>
        )}

        <div className="mt-4 space-y-4">
          {f.type === "site_expense" && (
            <>
              <Labeled label="Site">
                <CustomSelect
                  value={f.project_id}
                  onChange={(val) => set({ project_id: val })}
                  options={projects.map((p) => ({
                    label: `${p.name} (${inr(p.balance)} available)`,
                    value: String(p.id),
                  }))}
                  placeholder="Select site…"
                />
              </Labeled>
              <Labeled label="Paid From">
                <CustomSelect
                  value={siteExpenseFrom}
                  onChange={(val) => set({ paidFrom: val })}
                  options={[
                    {
                      group: "Site funds",
                      items: [
                        {
                          label: selectedSite
                            ? `Site funds (${inr(selectedSite.balance)} available)`
                            : "Site funds",
                          value: "site",
                        },
                      ],
                    },
                    ...(fundedAll.length > 0
                      ? [
                          {
                            group: "Direct from account",
                            items: fundedAll.map((a) => ({
                              label: `${a.name} · ${ACCOUNT_TYPE_LABELS[a.account_type]} (${inr(a.current_balance)})`,
                              value: `acc:${a.id}`,
                            })),
                          },
                        ]
                      : []),
                  ]}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {siteExpenseFrom === "site"
                    ? "Deducted from the site’s allocated funds."
                    : "Paid directly from the account — site funds stay untouched."}
                </p>
              </Labeled>
            </>
          )}

          {f.type === "expense" && (
            <Labeled label="Paid From (account)">
              <CustomSelect value={f.paidFrom} onChange={(val) => set({ paidFrom: val })} options={fundedSourceOptions()} placeholder="Select…" />
              <p className="mt-1 text-xs text-muted-foreground">
                Not tied to a site. For a site expense, use the “Site Expense” tab.
              </p>
            </Labeled>
          )}

          {f.type === "transfer" && (
            <>
              <Labeled label="Source Account">
                <CustomSelect
                  value={f.source_account_id}
                  onChange={(val) => {
                    set({ source_account_id: val, dest: f.dest === `acc:${val}` ? "" : f.dest });
                  }}
                  options={[
                    { group: "Accounts", items: fundedBanks.map(accOpt) },
                    ...(fundedPartners.length > 0 ? [{ group: "Partners", items: fundedPartners.map(accOpt) }] : [])
                  ]}
                  placeholder="Select…"
                />
              </Labeled>
              <Labeled label="Destination Account">
                <CustomSelect value={f.dest} onChange={(val) => set({ dest: val })} options={accountOptions(f.source_account_id, true)} placeholder="Select…" />
                <p className="mt-1 text-xs text-muted-foreground">
                  To send money to a site, use “Allocate Funds” instead.
                </p>
              </Labeled>
            </>
          )}

          {f.type === "partner_withdrawal" && (
            <Labeled label="Partner">
              <CustomSelect value={f.source_account_id} onChange={(val) => set({ source_account_id: val })} options={fundedPartners.map(accOpt)} placeholder="Select partner…" />
              <p className="mt-1 text-xs text-muted-foreground">Money is taken out of this partner’s account.</p>
            </Labeled>
          )}

          {(f.type === "expense" || f.type === "site_expense") && (
            <Labeled label="Paid To (optional)">
              <PaidToPicker value={f.paid_to} onChange={(val) => set({ paid_to: val })} />
            </Labeled>
          )}
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
