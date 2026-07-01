"use client";
import { useEffect, useMemo, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { Button, Input, CustomSelect, CustomDatePicker, Field } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, todayISO, sanitizeAmount } from "@/lib/format";

type Account = { id: number; name: string; account_type: string; current_balance: number };
type Project = { id: number; name: string; balance: number };

const LAST_SRC_KEY = "lastSourceAccountId";

export default function AllocateFundsSheet({
  open,
  onClose,
  presetProjectId,
}: {
  open: boolean;
  onClose: () => void;
  presetProjectId?: number;
}) {
  const { toast } = useUI();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDate(todayISO());
    setErr("");
    fetch("/api/projects").then((r) => r.json()).then((j) => {
      const ps: Project[] = j.data;
      setProjects(ps);
      setProjectId(presetProjectId?.toString() || (ps[0] ? String(ps[0].id) : ""));
    });
    fetch("/api/accounts").then((r) => r.json()).then((j) => {
      const as: Account[] = j.data;
      // Any account that actually has money (bank, cash or partner) can fund a site.
      const funded = as.filter((a) => a.current_balance > 0);
      setAccounts(funded);
      const last = typeof window !== "undefined" ? localStorage.getItem(LAST_SRC_KEY) : null;
      const pick =
        (last && funded.some((a) => String(a.id) === last) ? last : "") ||
        // default: account with the highest balance
        (funded.length ? String([...funded].sort((a, b) => b.current_balance - a.current_balance)[0].id) : "");
      setSourceId(pick);
    });
  }, [open, presetProjectId]);

  const source = useMemo(() => accounts.find((a) => String(a.id) === sourceId), [accounts, sourceId]);
  const project = useMemo(() => projects.find((p) => String(p.id) === projectId), [projects, projectId]);
  const amt = Number(amount) || 0;
  const overBudget = !!source && amt > 0 && amt > source.current_balance;

  if (!open) return null;

  async function submit() {
    setErr("");
    if (!sourceId) return setErr("Select a source account");
    if (!projectId) return setErr("Select a site");
    if (!amt || amt <= 0) return setErr("Enter a valid amount");
    if (source && amt > source.current_balance)
      return setErr(`Insufficient funds — ${source.name} has only ${inr(source.current_balance)} available`);

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "transfer",
        source_account_id: sourceId,
        project_id: projectId,
        amount,
        txn_date: date,
      }),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Something went wrong");

    if (typeof window !== "undefined") localStorage.setItem(LAST_SRC_KEY, sourceId);
    window.dispatchEvent(new CustomEvent("txn:created"));
    toast(`Added ${inr(amt)} to ${project?.name ?? "site"}`, "success");
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {presetProjectId && project ? `Add Site Fund to ${project.name}` : "Add Site Fund"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Field label="Amount" required>
          <Input
            autoFocus
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
            placeholder="0"
            className={`!py-3 !text-3xl !font-bold ${overBudget ? "!border-danger !ring-danger/20" : ""}`}
          />
        </Field>

        <div className="mt-4 space-y-4">
          <Field label="From Account" required>
            <CustomSelect
              value={sourceId}
              onChange={(val) => setSourceId(val)}
              disabled={accounts.length === 0}
              options={[
                {
                  group: "Accounts",
                  items: accounts
                    .filter((a) => a.account_type !== "partner")
                    .map((a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: String(a.id) })),
                },
                ...(accounts.some((a) => a.account_type === "partner")
                  ? [
                      {
                        group: "Partners",
                        items: accounts
                          .filter((a) => a.account_type === "partner")
                          .map((a) => ({ label: `${a.name} (${inr(a.current_balance)})`, value: String(a.id) })),
                      },
                    ]
                  : []),
              ]}
              placeholder="Select account…"
            />
            {accounts.length === 0 && (
              <p className="mt-1 text-xs text-warning">No account has available balance to add.</p>
            )}
          </Field>
          <Field label="To Site" required>
            <CustomSelect
              value={projectId}
              onChange={(val) => setProjectId(val)}
              disabled={!!presetProjectId}
              options={projects.map((p) => ({
                label: `${p.name} (balance ${inr(p.balance)})`,
                value: String(p.id)
              }))}
              placeholder="Select…"
            />
            {presetProjectId && (
              <p className="mt-1 text-xs text-muted-foreground">Locked to the selected site</p>
            )}
          </Field>
        </div>

        {/* Confirmation preview */}
        {source && project && amt > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-center gap-2 font-medium">
              <span>{source.name}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span>{project.name}</span>
            </div>
            <div className="mt-2 flex justify-between text-muted-foreground">
              <span>Amount</span>
              <span className="font-semibold text-foreground">{inr(amt)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>New site balance</span>
              <span className="font-semibold text-success">{inr(project.balance + amt)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{source.name} after</span>
              <span className={source.current_balance - amt < 0 ? "font-semibold text-danger" : "font-semibold text-foreground"}>
                {inr(source.current_balance - amt)}
              </span>
            </div>
          </div>
        )}

        {err && <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{err}</p>}

        {overBudget && source && (
          <p className="mt-3 text-xs font-medium text-danger">
            Insufficient funds — only {inr(source.current_balance)} available in {source.name}.
          </p>
        )}

        <Button onClick={submit} loading={saving} disabled={overBudget} className="mt-5 w-full !py-3 text-base">
          Add Site Fund
        </Button>
      </div>
    </div>
  );
}
