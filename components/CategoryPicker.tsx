"use client";
import { useEffect, useState } from "react";
import { Plus, Check, Tag } from "lucide-react";
import { Input } from "@/components/ui";
import { useUI } from "@/components/UIProvider";
import { CATEGORY_ICON } from "@/lib/format";

type Cat = { id: number; name: string };

// Expense category selector. Loads categories from the DB and lets the admin add a
// new one inline (saved to the categories table) without leaving the form.
export default function CategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const { toast } = useUI();
  const [cats, setCats] = useState<Cat[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/categories").then((r) => r.json()).then((j) => setCats(j.data));
  useEffect(() => {
    load();
  }, []);

  // Live match against existing categories (case-insensitive).
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const exactMatch = cats.find((c) => c.name.toLowerCase() === lower);
  const suggestions = trimmed
    ? cats.filter((c) => c.name.toLowerCase().includes(lower) && c.name.toLowerCase() !== lower).slice(0, 6)
    : [];

  function selectExisting(catName: string) {
    onChange(catName);
    setName("");
    setAdding(false);
  }

  // Enter / ✓ : pick the existing category if it already exists, otherwise create it.
  function confirm() {
    if (!trimmed) return;
    if (exactMatch) {
      selectExisting(exactMatch.name);
    } else {
      createCategory();
    }
  }

  async function createCategory() {
    const clean = name.trim();
    if (!clean) return;
    setSaving(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clean }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast(j.message || "Could not add category", "error");
      return;
    }
    toast("Category added", "success");
    await load();
    onChange(j.data.name); // auto-select the new category
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {cats.map((c) => {
        const Icon = CATEGORY_ICON[c.name] || Tag;
        const active = value === c.name;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.name)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              active ? "border-primary bg-primary text-white" : "border-border hover:bg-muted"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {c.name}
          </button>
        );
      })}

      {adding ? (
        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setName("");
                }
              }}
              placeholder="Type a category"
              className="!w-40 !py-1.5"
            />
            <button
              type="button"
              onClick={confirm}
              disabled={saving || !trimmed}
              aria-label={exactMatch ? "Select category" : "Create category"}
              className="rounded-full bg-primary p-1.5 text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Existing-match helper: select instead of duplicating. */}
          {trimmed && exactMatch ? (
            <p className="text-xs text-muted-foreground">
              “{exactMatch.name}” already exists — press ✓ to select it.
            </p>
          ) : trimmed && suggestions.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Existing:</span>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectExisting(s.name)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : trimmed ? (
            <p className="text-xs text-muted-foreground">Press ✓ to create “{trimmed}”.</p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      )}
    </div>
  );
}
