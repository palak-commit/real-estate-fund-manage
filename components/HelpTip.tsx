"use client";
import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";

// Inline help bubble. Pass a glossary `term` (preferred — keeps wording consistent)
// or raw `text`. Opens on hover, keyboard focus, AND tap (works on mobile, unlike a
// native title= tooltip). Accessible: it's a real button with an aria-label.
export default function HelpTip({
  term,
  text,
  label,
  className = "",
}: {
  term?: GlossaryTerm;
  text?: string;
  label?: string; // screen-reader label, e.g. "What is RA?"
  className?: string;
}) {
  const body = text ?? (term ? GLOSSARY[term] : "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close when tapping/clicking anywhere else (mobile).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!body) return null;

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label ?? "More info"}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-muted-foreground transition hover:text-primary focus:text-primary focus:outline-none"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-border bg-card p-2.5 text-left text-xs font-normal normal-case leading-relaxed text-foreground shadow-lg"
        >
          {body}
        </span>
      )}
    </span>
  );
}
