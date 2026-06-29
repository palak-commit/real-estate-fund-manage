"use client";
import { useEffect, useState } from "react";
import { Plus, Check, Tag } from "lucide-react";
import { Input } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { CATEGORY_ICON } from "@/lib/format";

type Sub = { id: number; name: string };
type Head = { id: number; name: string; subheads: Sub[] };

// Two-level expense category selector (Head → Sub-Head). The caller holds the selected
// Sub-Head id (the leaf); the head is just for navigation. Admins can add a head or a
// sub-head inline without leaving the form. `value` is the selected sub-head id ("" = none).
export default function CategoryPicker({
  value,
  onChange,
}: {
  value: number | string;
  onChange: (subHeadId: number) => void;
}) {
  const { toast } = useUI();
  const [heads, setHeads] = useState<Head[]>([]);
  const [loading, setLoading] = useState(true);
  const [headId, setHeadId] = useState<number | null>(null);
  // Inline add: which level we're adding, plus the typed name + saving flag.
  const [addMode, setAddMode] = useState<null | "head" | "sub">(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedLeaf = value ? Number(value) : null;

  const load = (selectLeaf?: number | null) =>
    fetch("/api/categories")
      .then((r) => r.json())
      .then((j) => {
        const hs: Head[] = j.data || [];
        setHeads(hs);
        // Keep the open head in sync with the currently-selected leaf.
        const leaf = selectLeaf ?? selectedLeaf;
        if (leaf != null) {
          const h = hs.find((x) => x.subheads.some((s) => s.id === leaf));
          if (h) setHeadId(h.id);
        }
        return hs;
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeHead = heads.find((h) => h.id === headId) || null;
  const trimmed = name.trim();

  function selectHead(h: Head) {
    setHeadId(h.id);
    setAddMode(null);
    setName("");
  }

  async function createCategory(parentId: number | null) {
    const clean = name.trim();
    if (!clean) return;
    setSaving(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parentId == null ? { name: clean } : { name: clean, parent_id: parentId }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast(j.message || "Could not add category", "error");
      return;
    }
    toast(parentId == null ? "Head added" : "Sub-category added", "success");
    const hs = await load(parentId == null ? null : j.data.id);
    setName("");
    setAddMode(null);
    if (parentId == null) {
      // New head — open it so the user can add/pick a sub-head next.
      setHeadId(j.data.id);
    } else {
      // New sub-head — auto-select it.
      const h = (hs || []).find((x) => x.id === parentId);
      setHeadId(parentId);
      if (h) onChange(j.data.id);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[34px] w-24 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Step 1 — Head */}
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Head</p>
        <div className="flex flex-wrap gap-2">
          {heads.map((h) => {
            const Icon = CATEGORY_ICON[h.name] || Tag;
            const active = headId === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => selectHead(h)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  active ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {h.name}
              </button>
            );
          })}

          {addMode === "head" ? (
            <InlineAdd
              placeholder="New head"
              name={name}
              setName={setName}
              saving={saving}
              disabled={!trimmed}
              onConfirm={() => createCategory(null)}
              onCancel={() => {
                setAddMode(null);
                setName("");
              }}
            />
          ) : (
            <AddChip label="Add head" onClick={() => { setAddMode("head"); setName(""); }} />
          )}
        </div>
      </div>

      {/* Step 2 — Sub-Head (only once a head is chosen) */}
      {activeHead && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sub-category · {activeHead.name}
          </p>
          <div className="flex flex-wrap gap-2">
            {activeHead.subheads.map((s) => {
              const active = selectedLeaf === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    active ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}

            {addMode === "sub" ? (
              <InlineAdd
                placeholder="New sub-category"
                name={name}
                setName={setName}
                saving={saving}
                disabled={!trimmed}
                onConfirm={() => createCategory(activeHead.id)}
                onCancel={() => {
                  setAddMode(null);
                  setName("");
                }}
              />
            ) : (
              <AddChip label="Add" onClick={() => { setAddMode("sub"); setName(""); }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function InlineAdd({
  placeholder,
  name,
  setName,
  saving,
  disabled,
  onConfirm,
  onCancel,
}: {
  placeholder: string;
  name: string;
  setName: (v: string) => void;
  saving: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!disabled) onConfirm();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        placeholder={placeholder}
        className="!w-40 !py-1.5"
      />
      <button
        type="button"
        onClick={onConfirm}
        disabled={saving || disabled}
        aria-label="Save category"
        className="rounded-full bg-primary p-1.5 text-white transition hover:opacity-90 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
