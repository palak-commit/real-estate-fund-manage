"use client";
import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Card, Select, EmptyState } from "@/components/ui";
import { TxnRow } from "@/components/TxnRow";
import { TYPE_LABELS } from "@/lib/format";

type Project = { id: number; name: string };

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

export default function HistoryPage() {
  const [txns, setTxns] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [type, setType] = useState("");
  const [projectId, setProjectId] = useState("");

  const load = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: "300" });
    if (type) qs.set("type", type);
    if (projectId) qs.set("project_id", projectId);
    fetch(`/api/transactions?${qs}`).then((r) => r.json()).then(setTxns);
  }, [type, projectId]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-auto">
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="!w-auto">
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{txns?.length ?? "—"} entries</span>
      </div>

      <Card className="overflow-hidden">
        {!txns ? (
          <ListSkeleton />
        ) : txns.length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" />}>No transactions found.</EmptyState>
        ) : (
          <div className="divide-y divide-border">
            {txns.map((t) => (
              <TxnRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
