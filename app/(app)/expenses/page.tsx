"use client";
import { useCallback, useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { Card, Select, Input, EmptyState } from "@/components/ui";
import { TxnRow } from "@/components/TxnRow";
import { inr, todayISO } from "@/lib/format";

type Project = { id: number; name: string };
type Account = { id: number; name: string; account_type: string };
type Category = { id: number; name: string };

function ListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
          <div className="skeleton h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function ExpensesPage() {
  const [txns, setTxns] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  const [account, setAccount] = useState(""); // "", "site", or an account id
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: "200", type: "expense" });
    if (projectId) qs.set("project_id", projectId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/transactions?${qs}`)
      .then((r) => r.json())
      .then((res) => setTxns(res.data ?? []));
  }, [projectId, from, to]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data));
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategories(j.data));
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((j) => setAccounts((j.data as Account[]).filter((a) => a.account_type !== "partner")));
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  // Category and account filters happen client-side so the total reflects the visible rows.
  const rows = (txns ?? []).filter((t) => {
    if (category && t.category !== category) return false;
    if (account === "site" && t.source_account_id != null) return false;
    if (account && account !== "site" && String(t.source_account_id) !== account) return false;
    return true;
  });
  const total = rows.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>

      <div className="flex flex-wrap items-end gap-3">
        <Filter label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="!w-auto">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label="Site">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="!w-auto">
            <option value="">All Sites</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label="Paid From">
          <Select value={account} onChange={(e) => setAccount(e.target.value)} className="!w-auto">
            <option value="">All Sources</option>
            <option value="site">Site funds</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Filter>
        <Filter label="From">
          <Input type="date" max={to || todayISO()} value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto" />
        </Filter>
        <Filter label="To">
          <Input type="date" max={todayISO()} min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto" />
        </Filter>
        {(category || projectId || account || from || to) && (
          <button
            onClick={() => {
              setCategory("");
              setProjectId("");
              setAccount("");
              setFrom("");
              setTo("");
            }}
            className="h-[42px] rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:bg-muted"
          >
            Clear
          </button>
        )}
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">{rows.length} expenses</p>
          <p className="font-semibold text-danger">{inr(total)} total</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {!txns ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ReceiptText className="h-6 w-6" />}>No expenses found.</EmptyState>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((t) => (
              <TxnRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
