"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Building2 } from "lucide-react";
import { Card, Button, Input, Select, Field, Label, Skeleton, EmptyState } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr, formatDate } from "@/lib/format";

type Project = {
  id: number;
  name: string;
  status: string;
  received: number;
  spent: number;
  balance: number;
  last_txn_date: string | null;
};

const STATUS = { active: "Active", on_hold: "On Hold", completed: "Completed" };
const STATUS_COLOR: Record<string, string> = { active: "green", on_hold: "amber", completed: "blue" };

export default function ProjectsPage() {
  const { toast, confirm } = useUI();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [form, setForm] = useState({ name: "", status: "active" });
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/projects").then((r) => r.json()).then((j) => setProjects(j.data));
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("txn:created", h);
    return () => window.removeEventListener("txn:created", h);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setForm({ name: "", status: "active" });
    toast("Site added", "success");
    load();
  }

  async function del(p: Project, e: React.MouseEvent) {
    e.preventDefault();
    const ok = await confirm({
      title: "Delete project?",
      message: `“${p.name}” will be removed. Its transactions stay but become unassigned.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    toast("Site deleted", "success");
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Add New Site</h2>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Green City" required />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" loading={saving} className="w-full">
              Add Site
            </Button>
          </div>
        </form>
      </Card>

      {!projects ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="h-6 w-6" />}>No projects yet.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="p-4 transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Building2 className="h-4 w-4 text-muted-foreground" /> {p.name}
                  </h3>
                  <Label color={STATUS_COLOR[p.status]}>{(STATUS as any)[p.status]}</Label>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <Row label="Received" value={inr(p.received)} className="text-success" />
                  <Row label="Spent" value={inr(p.spent)} className="text-danger" />
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-medium">Balance</span>
                    <span className={`font-bold ${p.balance < 0 ? "text-danger" : ""}`}>{inr(p.balance)}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Last: {p.last_txn_date ? formatDate(p.last_txn_date) : "—"}
                  </span>
                  <button onClick={(e) => del(p, e)} className="flex items-center gap-1 text-xs text-danger hover:underline">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${className}`}>{value}</span>
    </div>
  );
}
