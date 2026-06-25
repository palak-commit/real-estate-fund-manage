"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Plus, Search } from "lucide-react";

// Searchable "Paid To" combobox. Loads previously-used payees from the DB and lets
// the admin pick an existing one or type a brand-new name. New names aren't stored
// in a separate table — they persist automatically once the transaction is saved,
// so they show up here next time.
export default function PaidToPicker({
  value,
  onChange,
  placeholder = "e.g. Ramesh Contractor",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [payees, setPayees] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/payees")
      .then((r) => r.json())
      .then((j) => setPayees(Array.isArray(j.data) ? j.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const trimmed = search.trim();
  const lower = trimmed.toLowerCase();
  const filtered = trimmed
    ? payees.filter((p) => p.toLowerCase().includes(lower))
    : payees;
  const exactMatch = payees.some((p) => p.toLowerCase() === lower);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-card animate-fade-in">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && trimmed) {
                  e.preventDefault();
                  pick(trimmed);
                } else if (e.key === "Escape") {
                  setOpen(false);
                  setSearch("");
                }
              }}
              placeholder="Search or add a payee…"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-52 overflow-auto py-1">
            {/* Clear the current selection (e.g. reset a filter to "all"). */}
            {value && !trimmed && (
              <button
                type="button"
                onClick={() => pick("")}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                Clear selection
              </button>
            )}

            {/* Add the typed name when it isn't already an exact existing payee. */}
            {trimmed && !exactMatch && (
              <button
                type="button"
                onClick={() => pick(trimmed)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
                Add “{trimmed}”
              </button>
            )}

            {filtered.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pick(p)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  value === p ? "bg-primary/10 font-medium text-primary" : "text-foreground"
                }`}
              >
                {p}
                {value === p && <Check className="h-4 w-4" />}
              </button>
            ))}

            {filtered.length === 0 && !trimmed && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No saved payees yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
