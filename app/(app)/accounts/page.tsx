"use client";
import { useEffect, useState } from "react";
import { Pencil, Trash2, Check, X, Plus, RefreshCw } from "lucide-react";
import { Card, Button, Input, Select, Field, Label, Skeleton, EmptyState } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import AddFundsSheet from "@/components/AddFundsSheet";
import { inr, ACCOUNT_TYPE_LABELS } from "@/lib/format";

type Account = {
  id: number;
  name: string;
  account_type: string;
  opening_balance: number;
  current_balance: number;
};

const TYPE_COLOR: Record<string, string> = { bank: "blue", cash: "green", partner: "amber" };

export default function AccountsPage() {
  const { toast, confirm } = useUI();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [form, setForm] = useState({ name: "", account_type: "bank", opening_balance: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", account_type: "bank" });
  const [fundAccount, setFundAccount] = useState<Account | null>(null);
  const [rechecking, setRechecking] = useState(false);

  const load = () => fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data));

  async function recheckBalances() {
    setRechecking(true);
    try {
      const res = await fetch("/api/admin/recompute", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Could not recheck balances");
      toast(j.message, "success");
      if (j.data.corrected > 0) load();
    } catch (e: any) {
      toast(e.message || "Could not recheck balances", "error");
    } finally {
      setRechecking(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) return setErr((await res.json()).message || "Error");
    setForm({ name: "", account_type: "bank", opening_balance: "" });
    toast("Account added", "success");
    load();
  }

  async function del(a: Account) {
    const ok = await confirm({
      title: "Delete account?",
      message: `“${a.name}” will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/accounts/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast((await res.json()).message || "Could not delete", "error");
      return;
    }
    toast("Account deleted", "success");
    load();
  }

  function startEdit(a: Account) {
    setEditId(a.id);
    setEditForm({ name: a.name, account_type: a.account_type });
  }

  async function saveEdit(id: number) {
    await fetch(`/api/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditId(null);
    toast("Account updated", "success");
    load();
  }

  const sum = (type: string) =>
    (accounts || []).filter((a) => a.account_type === type).reduce((s, a) => s + Number(a.current_balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <Button variant="outline" onClick={recheckBalances} loading={rechecking} className="!py-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Recheck balances
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(["bank", "cash", "partner"] as const).map((t) => (
          <Card key={t} className="p-4">
            <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[t]} Total</p>
            {!accounts ? <Skeleton className="mt-2 h-6 w-24" /> : <p className="mt-1 text-lg font-bold">{inr(sum(t))}</p>}
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Add New Account</h2>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. HDFC Bank" required />
          </Field>
          <Field label="Type">
            <Select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Opening Balance">
            <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} placeholder="0" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" loading={saving} className="w-full">
              Add Account
            </Button>
          </div>
        </form>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 text-right font-medium">Opening</th>
              <th className="px-4 py-2.5 text-right font-medium">Current Balance</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!accounts ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState>No accounts yet.</EmptyState>
                </td>
              </tr>
            ) : (
              accounts.map((a) =>
                editId === a.id ? (
                  <tr key={a.id} className="bg-muted/40">
                    <td className="px-4 py-2">
                      <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </td>
                    <td className="px-4 py-2">
                      <Select value={editForm.account_type} onChange={(e) => setEditForm({ ...editForm, account_type: e.target.value })}>
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{inr(a.opening_balance)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{inr(a.current_balance)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button onClick={() => saveEdit(a.id)} className="!px-2.5">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => setEditId(null)} className="!px-2.5">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3">
                      <Label color={TYPE_COLOR[a.account_type]}>{ACCOUNT_TYPE_LABELS[a.account_type]}</Label>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{inr(a.opening_balance)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${a.current_balance < 0 ? "text-danger" : ""}`}>
                      {inr(a.current_balance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" onClick={() => setFundAccount(a)} className="!px-2.5 !py-1.5 text-xs">
                          <Plus className="h-3.5 w-3.5" /> Add Funds
                        </Button>
                        <Button variant="ghost" onClick={() => startEdit(a)} className="!px-2.5 text-muted-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="danger" onClick={() => del(a)} className="!px-2.5">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </Card>

      <AddFundsSheet
        open={!!fundAccount}
        account={fundAccount}
        onClose={() => {
          setFundAccount(null);
          load();
        }}
      />
    </div>
  );
}
