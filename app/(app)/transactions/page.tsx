"use client";
import { useCallback, useEffect, useState } from "react";
import { Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Select, Button, EmptyState } from "@/components/ui";
import { TxnRow } from "@/components/TxnRow";
import { TYPE_LABELS } from "@/lib/format";

type Project = { id: number; name: string };
type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
const PAGE_SIZE = 15;

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
  const [page, setPage] = useState(1);
  const [pg, setPg] = useState<Pagination | null>(null);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [type, projectId]);

  const load = useCallback(() => {
    setTxns(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (type) qs.set("type", type);
    if (projectId) qs.set("project_id", projectId);
    fetch(`/api/transactions?${qs}`)
      .then((r) => r.json())
      .then((res) => {
        setTxns(res.data ?? []);
        setPg(res.pagination ?? null);
      });
  }, [type, projectId, page]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data));
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  const from = pg && pg.total > 0 ? (pg.page - 1) * pg.limit + 1 : 0;
  const to = pg ? Math.min(pg.page * pg.limit, pg.total) : 0;

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
        <span className="ml-auto text-sm text-muted-foreground">
          {pg ? `${pg.total} entries` : "—"}
        </span>
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

      {pg && pg.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {from}–{to} of {pg.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!pg.hasPrevPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="!py-1.5 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-muted-foreground">
              Page {pg.page} of {pg.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={!pg.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="!py-1.5 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
