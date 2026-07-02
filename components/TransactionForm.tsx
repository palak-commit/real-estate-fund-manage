"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, ACCOUNT_TYPE_LABELS, TYPE_LABELS, todayISO, sanitizeAmount } from "@/lib/format";
import CategoryPicker from "@/components/CategoryPicker";
import PaidToPicker from "@/components/PaidToPicker";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Project = { id: number; name: string; balance: number; status?: string };

// "income" tab is intentionally hidden from the New Transaction form (income now arrives via
// RA receipt payments / Add Money). The income save-path below is kept for legacy/other use.
const TYPES = ["site_fund", "site_expense", "transfer", "partner_withdrawal"];
const labelFor = (tp: string) =>
  tp === "site_expense" ? "Site Expense" : tp === "site_fund" ? "Add Site Fund" : tp === "income" ? "Income" : TYPE_LABELS[tp];

function blank() {
  return {
    type: "site_fund",
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
      if (preset.type === "transfer") {
        // Transfer OUT of this site's funds — lock the source to the site; destination open.
        init.source_account_id = `proj:${preset.projectId}`;
      } else {
        init.paidFrom = `proj:${preset.projectId}`;
        init.dest = `proj:${preset.projectId}`;
        init.project_id = String(preset.projectId);
      }
    }
    setF(init);
    setErr("");
    fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data));
    // Only Active sites can be a source/destination for new transactions — On-Hold /
    // Completed sites are locked (existing RA & vendor bills settle via their own flows).
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => setProjects((j.data as Project[]).filter((p) => p.status === "active")));
  }, [open, preset?.type, preset?.projectId]);

  if (!open) return null;

  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  // Only accounts with money can be a source for transfers / partner withdrawals.
  const fundedPartners = accounts.filter((a) => a.account_type === "partner" && a.current_balance > 0);
  const fundedAll = accounts.filter((a) => a.current_balance > 0);
  // Sites with spare funds can also be a transfer source (money moved back out into an account
  // or into another site). Always include the currently-selected source site (e.g. when
  // preset from the site page) so a locked source never renders blank.
  const fundedSites = projects.filter((p) => p.balance > 0 || `proj:${p.id}` === f.source_account_id);
  // When opened from a site's "Transfer Fund" button, the source is fixed to that site.
  const lockSource = preset?.type === "transfer" && !!preset?.projectId && f.type === "transfer";
  // Transfer source is a site's funds when its value is a "proj:<id>" sentinel.
  const transferFromSite = f.type === "transfer" && f.source_account_id.startsWith("proj:");
  const transferSite = transferFromSite
    ? projects.find((p) => `proj:${p.id}` === f.source_account_id)
    : undefined;

  // Site Expense: which site, and where it's paid from ("site" funds or "acc:<id>").
  const selectedSite = projects.find((p) => String(p.id) === f.project_id);
  const siteExpenseFrom = f.paidFrom || "site";

  // Money-out limit: a money-out source can't be exceeded.
  const amt = Number(f.amount) || 0;
  const sourceAcctId =
    f.type === "site_expense"
      ? siteExpenseFrom.startsWith("acc:")
        ? siteExpenseFrom.slice(4)
        : ""
      : f.type === "transfer" || f.type === "partner_withdrawal" || f.type === "site_fund"
      ? f.source_account_id
      : "";
  const sourceAcct = sourceAcctId ? accounts.find((a) => String(a.id) === sourceAcctId) : undefined;
  // Over-budget when paying from an account, OR from site funds beyond the site's balance
  // (a site-funded expense, or a transfer out of a site's funds).
  const overSiteFunds =
    f.type === "site_expense" && siteExpenseFrom === "site" && !!selectedSite && amt > 0 && amt > selectedSite.balance;
  const overTransferSite = !!transferSite && amt > 0 && amt > transferSite.balance;
  const overBudget =
    (!!sourceAcct && amt > 0 && amt > sourceAcct.current_balance) || overSiteFunds || overTransferSite;

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
      payload.category_id = f.category; // holds the selected Sub-Head (leaf) id
      payload.project_id = f.project_id;
      payload.source_account_id = siteExpenseFrom === "site" ? "" : siteExpenseFrom.slice(4);
    } else if (f.type === "site_fund") {
      // Allocate money from an account into a site's funds (a transfer to the site).
      payload.type = "transfer";
      payload.source_account_id = f.source_account_id;
      payload.project_id = f.project_id;
    } else if (f.type === "income") {
      // Money coming in FROM a site (origin tag) INTO an account. The account actually
      // receives the cash; the site is just recorded as where the income came from.
      payload.source_account_id = "";
      payload.dest_account_id = f.dest_account_id;
      payload.project_id = f.project_id;
    } else if (f.type === "transfer") {
      const d = decode(f.dest);
      if (f.source_account_id.startsWith("proj:")) {
        // Source is a site's funds. Destination is either an account (money moved back out —
        // a withdrawal) or another site (a site→site fund transfer).
        payload.source_account_id = "";
        payload.project_id = f.source_account_id.slice(5);
        if (f.dest.startsWith("proj:")) {
          payload.dest_project_id = d.project_id; // site→site
        } else {
          payload.dest_account_id = d.dest_account_id; // site→account withdrawal
        }
      } else {
        payload.source_account_id = f.source_account_id;
        payload.dest_account_id = d.dest_account_id;
        payload.project_id = d.project_id;
      }
    } else if (f.type === "partner_withdrawal") {
      payload.source_account_id = f.source_account_id;
      payload.dest_account_id = f.dest_account_id;
    }

    if (!payload.amount || Number(payload.amount) <= 0) return setErr("Enter a valid amount");
    if (f.type === "site_expense" && !f.project_id) return setErr("Select a site");
    if (f.type === "site_fund" && !f.source_account_id) return setErr("Select a source account");
    if (f.type === "site_fund" && !f.project_id) return setErr("Select a site");
    if (f.type === "income" && !f.project_id) return setErr("Select a site");
    if (f.type === "income" && !f.dest_account_id) return setErr("Select an account");
    if (f.type === "transfer" && !f.source_account_id) return setErr("Select a source");
    if (f.type === "transfer" && !f.dest) return setErr("Select a destination");
    if (f.type === "transfer" && transferFromSite && f.dest === f.source_account_id)
      return setErr("Source and destination sites must be different");
    if (overSiteFunds && selectedSite)
      return setErr(`Insufficient site funds — ${selectedSite.name} has only ${inr(selectedSite.balance)} available`);
    if (overTransferSite && transferSite)
      return setErr(`Insufficient site funds — ${transferSite.name} has only ${inr(transferSite.balance)} available`);
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
  // Group a list of accounts into Bank / Cash / Partner sections (empty groups dropped).
  const groupByType = (list: Account[], opt: (a: Account) => { label: string; value: string }) =>
    (["bank", "cash", "partner"] as const)
      .map((tp) => ({
        group: ACCOUNT_TYPE_LABELS[tp],
        items: list.filter((a) => a.account_type === tp).map(opt),
      }))
      .filter((g) => g.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Amount
              <Req />
            </label>
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
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Date
              <Req />
            </label>
            <CustomDatePicker value={f.txn_date} onChange={(val) => set({ txn_date: val })} className="!w-full" align="right" />
          </div>
        </div>

        {/* Category chips */}
        {f.type === "site_expense" && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">
              Head <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
            </p>
            <CategoryPicker value={f.category} onChange={(id) => set({ category: String(id) })} />
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {f.type === "site_expense" && (
            <>
              <Labeled label="Site" required>
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
              <Labeled label="Paid From" required>
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
                    // Direct-from-account, split into Bank / Cash / Partner groups.
                    ...(["bank", "cash", "partner"] as const)
                      .map((tp) => ({
                        group: ACCOUNT_TYPE_LABELS[tp],
                        items: fundedAll
                          .filter((a) => a.account_type === tp)
                          .map((a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: `acc:${a.id}` })),
                      }))
                      .filter((g) => g.items.length > 0),
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

          {f.type === "site_fund" && (
            <>
              <Labeled label="From Account" required>
                <CustomSelect
                  value={f.source_account_id}
                  onChange={(val) => set({ source_account_id: val })}
                  options={groupByType(fundedAll, accOpt)}
                  placeholder="Select account…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Money is moved from this account into the site’s funds.
                </p>
              </Labeled>
              <Labeled label="To Site" required>
                <CustomSelect
                  value={f.project_id}
                  onChange={(val) => set({ project_id: val })}
                  options={projects.map((p) => ({
                    label: `${p.name} (balance ${inr(p.balance)})`,
                    value: String(p.id),
                  }))}
                  placeholder="Select site…"
                />
              </Labeled>
            </>
          )}

          {f.type === "transfer" && (
            <>
              <Labeled label="Source" required>
                <CustomSelect
                  value={f.source_account_id}
                  disabled={lockSource}
                  onChange={(val) => {
                    // Clear the destination only if it now equals the new source (an account
                    // can't transfer to itself; a site can't transfer to itself).
                    const clearDest = f.dest === `acc:${val}` || f.dest === val;
                    set({ source_account_id: val, dest: clearDest ? "" : f.dest });
                  }}
                  options={[
                    // A site's own funds can be a source (money moved back out into an account).
                    ...(fundedSites.length
                      ? [{
                          group: "Site funds",
                          items: fundedSites.map((p) => ({
                            label: `${p.name} · Site Fund (${inr(p.balance)})`,
                            value: `proj:${p.id}`,
                          })),
                        }]
                      : []),
                    ...groupByType(fundedAll, accOpt),
                  ]}
                  placeholder="Select…"
                />
                {transferFromSite && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Money is moved out of this site’s funds into the destination account.
                  </p>
                )}
              </Labeled>
              <Labeled label="Destination" required>
                <CustomSelect
                  value={f.dest}
                  onChange={(val) => set({ dest: val })}
                  options={[
                    ...groupByType(
                      accounts.filter((a) => String(a.id) !== f.source_account_id),
                      (a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: `acc:${a.id}` })
                    ),
                    // Money can also go INTO a site's funds: from an account it's the same as
                    // "Add Site Fund"; from another site's funds it's a site→site transfer. The
                    // source site itself is excluded (a site can't transfer to itself).
                    ...(projects.length
                      ? [{
                          group: "Site funds",
                          items: projects
                            .filter((p) => `proj:${p.id}` !== f.source_account_id)
                            .map((p) => ({
                              label: `${p.name} · Site Fund (${inr(p.balance)})`,
                              value: `proj:${p.id}`,
                            })),
                        }]
                      : []),
                  ]}
                  placeholder="Select…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.dest.startsWith("proj:")
                    ? transferFromSite
                      ? "Funds move from the source site into this site."
                      : "Money is added to this site’s funds (like “Add Site Fund”)."
                    : "Pick an account, or a site to add money into its funds."}
                </p>
              </Labeled>
            </>
          )}

          {f.type === "income" && (
            <>
              <Labeled label="From" required>
                <CustomSelect
                  value={f.project_id}
                  onChange={(val) => set({ project_id: val })}
                  options={projects.map((p) => ({ label: p.name, value: String(p.id) }))}
                  placeholder="Select site…"
                />
                <p className="mt-1 text-xs text-muted-foreground">The site this income came from.</p>
              </Labeled>
              <Labeled label="To" required>
                <CustomSelect
                  value={f.dest_account_id}
                  onChange={(val) => set({ dest_account_id: val })}
                  options={groupByType(accounts, accOpt)}
                  placeholder="Select account…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The account that receives the money (bank, cash, or partner).
                </p>
              </Labeled>
            </>
          )}

          {f.type === "partner_withdrawal" && (
            <Labeled label="Partner" required className="sm:col-span-2">
              <CustomSelect value={f.source_account_id} onChange={(val) => set({ source_account_id: val })} options={fundedPartners.map(accOpt)} placeholder="Select partner…" />
              <p className="mt-1 text-xs text-muted-foreground">Money is taken out of this partner’s account.</p>
            </Labeled>
          )}

          {f.type === "site_expense" && (
            <Labeled label="Paid To (optional)" className="sm:col-span-2">
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

// A small red asterisk marking a required field.
function Req() {
  return <span className="text-danger"> *</span>;
}

function Labeled({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
        {label}
        {required && <Req />}
      </label>
      {children}
    </div>
  );
}
