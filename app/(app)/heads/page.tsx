"use client";
import { useEffect, useState } from "react";
import { Tag, Plus, Pencil, Trash2, Check, X, ChevronRight } from "lucide-react";
import { Card, Button, Input, EmptyState, Skeleton, Table, THead, TBody, Th, Td } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { inr } from "@/lib/format";

type SubHead = { id: number; name: string; spent: number };
type Head = { id: number; name: string; spent: number; subheads: SubHead[] };

export default function HeadsPage() {
  const { toast, confirm } = useUI();
  const [heads, setHeads] = useState<Head[] | null>(null);
  const [newHead, setNewHead] = useState("");
  const [savingHead, setSavingHead] = useState(false);
  // The head id we're adding a sub-head under, + its draft value.
  const [subFor, setSubFor] = useState<number | null>(null);
  const [newSub, setNewSub] = useState("");
  // Inline rename: which category id is being edited + the draft.
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  // Which heads are expanded to show their Types of Head table.
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const toggleOpen = (id: number) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const load = () => fetch("/api/categories").then((r) => r.json()).then((j) => setHeads(j.data ?? []));
  useEffect(() => {
    load();
  }, []);

  async function post(body: Record<string, unknown>, okMsg: string) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) return toast(j.message || "Something went wrong", "error");
    toast(okMsg, "success");
    load();
    return true;
  }

  async function addHead() {
    if (!newHead.trim()) return;
    setSavingHead(true);
    const done = await post({ name: newHead.trim() }, "Head added");
    setSavingHead(false);
    if (done) setNewHead("");
  }

  async function addSub(headId: number) {
    if (!newSub.trim()) return;
    const done = await post({ name: newSub.trim(), parent_id: headId }, "Type of head added");
    if (done) {
      setNewSub("");
      setSubFor(null);
    }
  }

  async function rename(id: number) {
    if (!editVal.trim()) return;
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editVal.trim() }),
    });
    const j = await res.json();
    if (!res.ok) return toast(j.message || "Could not rename", "error");
    toast("Renamed", "success");
    setEditId(null);
    load();
  }

  async function remove(c: { id: number; name: string }, isHead: boolean) {
    const ok = await confirm({
      title: `Delete ${isHead ? "head" : "type of head"}?`,
      message: isHead
        ? `"${c.name}" and all its types of head will be removed. Refused if any transaction still uses them.`
        : `"${c.name}" will be removed. Refused if any transaction still uses it.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) return toast(j.message || "Could not delete", "error");
    toast("Deleted", "success");
    load();
  }

  const startEdit = (id: number, name: string) => {
    setEditId(id);
    setEditVal(name);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Tag className="h-6 w-6 text-muted-foreground" /> Heads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your expense <strong>Heads</strong> and their <strong>Types of Head</strong> (sub-categories).
        </p>
      </div>

      {/* Add a new head */}
      <Card className="flex flex-wrap items-end gap-3 !p-4">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <label className="block text-sm font-medium text-muted-foreground">New Head</label>
          <Input
            value={newHead}
            onChange={(e) => setNewHead(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHead()}
            placeholder="e.g. Material, Labour Exp."
          />
        </div>
        <Button onClick={addHead} loading={savingHead} className="shrink-0">
          <Plus className="h-4 w-4" /> Add Head
        </Button>
      </Card>

      {/* Head list */}
      {!heads ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : heads.length === 0 ? (
        <Card>
          <EmptyState icon={<Tag className="h-6 w-6" />}>No heads yet. Add your first one above.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {heads.map((h) => {
            const open = openIds.has(h.id);
            return (
            <Card key={h.id} className="!p-0">
              {/* Head header — click to expand its Types of Head */}
              <div className="flex items-center justify-between gap-3 p-4">
                {editId === h.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename(h.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="max-w-xs"
                    />
                    <Button variant="outline" onClick={() => rename(h.id)} className="!px-2">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setEditId(null)} className="!px-2">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleOpen(h.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={open}
                  >
                    <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-90" : ""}`} />
                    <h2 className="truncate text-base font-semibold text-foreground">{h.name}</h2>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {h.subheads.length}
                    </span>
                    <span className="ml-auto shrink-0 text-sm font-semibold text-foreground" title="Total spent under this head">
                      {inr(h.spent)}
                    </span>
                  </button>
                )}
                {editId !== h.id && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => startEdit(h.id, h.name)}
                      aria-label="Rename head"
                      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(h, true)}
                      aria-label="Delete head"
                      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Types of Head table — shown when expanded */}
              {open && (
                <div className="border-t border-border">
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <Th>Type of Head</Th>
                        <Th right>Spent</Th>
                        <Th right>Actions</Th>
                      </THead>
                      <TBody>
                        {h.subheads.length === 0 && (
                          <tr>
                            <Td className="text-muted-foreground">No types of head yet.</Td>
                            <Td right>—</Td>
                            <Td right>—</Td>
                          </tr>
                        )}
                        {h.subheads.map((s) => (
                          <tr key={s.id}>
                            <Td>
                              {editId === s.id ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Input
                                    autoFocus
                                    value={editVal}
                                    onChange={(e) => setEditVal(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") rename(s.id);
                                      if (e.key === "Escape") setEditId(null);
                                    }}
                                    className="!h-8 !w-40 !py-0 !text-sm"
                                  />
                                  <button onClick={() => rename(s.id)} className="text-success" aria-label="Save">
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => setEditId(null)} className="text-muted-foreground" aria-label="Cancel">
                                    <X className="h-4 w-4" />
                                  </button>
                                </span>
                              ) : (
                                s.name
                              )}
                            </Td>
                            <Td right className="font-medium">{inr(s.spent)}</Td>
                            <Td right>
                              {editId !== s.id && (
                                <span className="flex items-center justify-end gap-0.5">
                                  <button
                                    onClick={() => startEdit(s.id, s.name)}
                                    className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                    aria-label="Rename type"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => remove(s, false)}
                                    className="rounded-lg p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                                    aria-label="Delete type"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>

                  {/* Add a type of head under this head */}
                  <div className="p-3">
                    {subFor === h.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Input
                          autoFocus
                          value={newSub}
                          onChange={(e) => setNewSub(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addSub(h.id);
                            if (e.key === "Escape") setSubFor(null);
                          }}
                          placeholder="New type of head"
                          className="!h-8 !w-40 !py-0 !text-sm"
                        />
                        <Button variant="outline" onClick={() => addSub(h.id)} className="!px-2 !py-1">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => setSubFor(null)} className="!px-2 !py-1">
                          <X className="h-4 w-4" />
                        </Button>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSubFor(h.id);
                          setNewSub("");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground transition hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add type
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
