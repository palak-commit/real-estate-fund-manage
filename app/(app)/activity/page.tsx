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
} from "lucide-react";
import { Card, Button, EmptyState, CustomSelect } from "@/components/ui";
import { inr, formatDate } from "@/lib/format";

type ActivityMeta = { detail?: string; note?: string | null } | null;
type ActivityRow = {
  id: number;
  action: "created" | "updated" | "deleted" | "recompute";
  entity: "transaction" | "account" | "site" | "category" | "system";
  entity_id: number | null;
  title: string;
  amount: number | null;
  meta: ActivityMeta;
  created_at: string;
};

// meta is a JSON column — mysql2 usually returns it parsed, but guard for a string too.
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
type Pagination = {
  page: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
const PAGE_SIZE = 30;

const ENTITY_ICON: Record<ActivityRow["entity"], any> = {
  transaction: Receipt,
  account: Landmark,
  site: Building2,
  category: Tag,
  system: RefreshCw,
};
const ACTION_ICON: Record<ActivityRow["action"], any> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  recompute: RefreshCw,
};
const ACTION_STYLE: Record<ActivityRow["action"], string> = {
  created: "bg-success/10 text-success",
  updated: "bg-info/10 text-info",
  deleted: "bg-danger/10 text-danger",
  recompute: "bg-warning/10 text-warning",
};
const ACTION_LABEL: Record<ActivityRow["action"], string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  recompute: "Recheck",
};

function timeOf(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [pg, setPg] = useState<Pagination | null>(null);
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [entity]);

  const load = useCallback(() => {
    setRows(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (entity) qs.set("entity", entity);
    fetch(`/api/activity?${qs}`)
      .then((r) => r.json())
      .then((res) => {
        setRows(res.data ?? []);
        setPg(res.pagination ?? null);
      });
  }, [entity, page]);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ActivityIcon className="h-6 w-6 text-muted-foreground" /> Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything that happened across your fund, newest first.</p>
        </div>
        <div className="w-44">
          <CustomSelect
            value={entity}
            onChange={setEntity}
            onClear={() => setEntity("")}
            options={[
              { label: "All Activity", value: "" },
              { label: "Transactions", value: "transaction" },
              { label: "Accounts", value: "account" },
              { label: "Sites", value: "site" },
              { label: "Categories", value: "category" },
              { label: "System", value: "system" },
            ]}
            placeholder="All Activity"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {!rows ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ActivityIcon className="h-6 w-6" />}>No activity yet.</EmptyState>
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
                          <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-foreground">
                            {inr(r.amount)}
                          </span>
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
            <Button
              variant="outline"
              disabled={!pg.hasPrevPage}
              onClick={() => setPage((pp) => Math.max(1, pp - 1))}
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
              onClick={() => setPage((pp) => pp + 1)}
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

function ListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
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
