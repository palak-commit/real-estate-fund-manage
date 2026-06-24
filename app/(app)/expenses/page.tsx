"use client";
import { useCallback, useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { Card, CustomSelect, CustomDatePicker, EmptyState } from "@/components/ui";
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
          <CustomSelect
            value={category}
            onChange={(val) => setCategory(val)}
            options={[
              { label: "All Categories", value: "" },
              ...categories.map((c) => ({ label: c.name, value: c.name }))
            ]}
            placeholder="All Categories"
            className="w-40"
          />
        </Filter>
        <Filter label="Site">
          <CustomSelect
            value={projectId}
            onChange={(val) => setProjectId(val)}
            options={[
              { label: "All Sites", value: "" },
              ...projects.map((p) => ({ label: p.name, value: String(p.id) }))
            ]}
            placeholder="All Sites"
            className="w-40"
          />
        </Filter>
        <Filter label="Paid From">
          <CustomSelect
            value={account}
            onChange={(val) => setAccount(val)}
            options={[
              { label: "All Sources", value: "" },
              { label: "Site funds", value: "site" },
              ...accounts.map((a) => ({ label: a.name, value: String(a.id) }))
            ]}
            placeholder="All Sources"
            className="w-40"
          />
        </Filter>
        <Filter label="From">
          <CustomDatePicker value={from} onChange={(val) => setFrom(val)} className="w-40" />
        </Filter>
        <Filter label="To">
          <CustomDatePicker value={to} onChange={(val) => setTo(val)} className="w-40" align="right" />
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
