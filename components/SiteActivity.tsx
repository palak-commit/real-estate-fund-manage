"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Landmark,
  Building2,
  Tag,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ShoppingCart,
} from "lucide-react";
import { Card, Button, EmptyState, CustomSelect } from "@/components/ui";
import { inr, formatDate } from "@/lib/format";

type ActivityMeta = { detail?: string; note?: string | null } | null;
type Entity = "transaction" | "account" | "site" | "category" | "system" | "ra_receipt" | "vendor_bill";
type ActivityRow = {
  id: number;
  action: "created" | "updated" | "deleted" | "recompute";
  entity: Entity;
  entity_id: number | null;
  title: string;
  amount: number | null;
  meta: ActivityMeta;
  created_at: string;
};

function parseMeta(meta: any): ActivityMeta {
  if (!meta) return null;
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta);
    } catch {
      return null;
    }
  }
  return meta;
}

type Pagination = { page: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
const PAGE_SIZE = 30;

const ENTITY_ICON: Record<Entity, any> = {
  transaction: Receipt,
  account: Landmark,
  site: Building2,
  category: Tag,
  system: RefreshCw,
  ra_receipt: FileText,
  vendor_bill: ShoppingCart,
};
const ACTION_ICON = { created: Plus, updated: Pencil, deleted: Trash2, recompute: RefreshCw } as const;
const ACTION_STYLE = {
  created: "bg-success/10 text-success",
  updated: "bg-info/10 text-info",
  deleted: "bg-danger/10 text-danger",
  recompute: "bg-warning/10 text-warning",
} as const;
const ACTION_LABEL = { created: "Created", updated: "Updated", deleted: "Deleted", recompute: "Recheck" } as const;

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

// The activity feed scoped to one site (site-detail Activity tab). Mirrors the global
// /activity page, but filtered by project_id and with a site-relevant entity filter.
export default function SiteActivity({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [pg, setPg] = useState<Pagination | null>(null);
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [entity]);

  const load = useCallback(() => {
    setRows(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page), project_id: String(projectId) });
    if (entity) qs.set("entity", entity);
    fetch(`/api/activity?${qs}`)
      .then((r) => r.json())
      .then((res) => {
        setRows(res.data ?? []);
        setPg(res.pagination ?? null);
      });
  }, [entity, page, projectId]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, [load]);

  // Group rows by calendar day for date headers.
  const groups: { day: string; items: ActivityRow[] }[] = [];
  for (const r of rows ?? []) {
    const day = formatDate(r.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(r);
    else groups.push({ day, items: [r] });
  }

  const rangeStart = pg && pg.total > 0 ? (pg.page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = pg ? Math.min(pg.page * PAGE_SIZE, pg.total) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Everything that happened on this site, newest first.</p>
        <div className="w-44">
          <CustomSelect
            value={entity}
            onChange={setEntity}
            onClear={() => setEntity("")}
            options={[
              { label: "All Activity", value: "" },
              { label: "Transactions", value: "transaction" },
              { label: "RA Receipts", value: "ra_receipt" },
              { label: "Vendor Bills", value: "vendor_bill" },
              { label: "Site", value: "site" },
            ]}
            placeholder="All Activity"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {!rows ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ActivityIcon className="h-6 w-6" />}>No activity for this site yet.</EmptyState>
        ) : (
          <div>
            {groups.map((g) => (
              <div key={g.day}>
                <p className="border-b border-border bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.day}
                </p>
                <div className="divide-y divide-border">
                  {g.items.map((r) => {
                    const Icon = ENTITY_ICON[r.entity] || ActivityIcon;
                    const ActionIcon = ACTION_ICON[r.action];
                    const meta = parseMeta(r.meta);
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ACTION_STYLE[r.action]}`}>
                          <Icon className="h-[18px] w-[18px]" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{r.title}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${ACTION_STYLE[r.action]}`}>
                              <ActionIcon className="h-3 w-3" />
                              {ACTION_LABEL[r.action]}
                            </span>
                          </div>
                          {meta?.detail && <p className="truncate text-xs text-muted-foreground">{meta.detail}</p>}
                          <p className="text-xs text-muted-foreground/70">
                            {timeOf(r.created_at)}
                            {meta?.note ? ` · ${meta.note}` : ""}
                          </p>
                        </div>
                        {r.amount != null && (
                          <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-foreground">{inr(r.amount)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {pg && pg.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {pg.total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!pg.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))} className="!py-1.5 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-muted-foreground">
              Page {pg.page} of {pg.totalPages}
            </span>
            <Button variant="outline" disabled={!pg.hasNextPage} onClick={() => setPage((p) => p + 1)} className="!py-1.5 text-xs">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-3 w-1/4" />
          </div>
          <div className="skeleton h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
