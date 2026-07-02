"use client";
import { ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { Calendar } from "./Calendar";
import { CustomDatePicker } from "./CustomDatePicker";

export { CustomSelect, Calendar, CustomDatePicker };

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-card ${className}`}>{children}</div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger" | "outline";
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const styles = {
    primary: "bg-primary text-white hover:opacity-90",
    outline: "border border-border bg-card hover:bg-muted text-foreground",
    ghost: "hover:bg-muted text-foreground",
    danger: "text-danger hover:bg-danger/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={`min-h-[44px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 ${props.className || ""}`}
      />
    );
  }
);

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-[44px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${props.className || ""}`}
    />
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}

export function Label({ children, color = "muted" }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    green: "bg-success/10 text-success",
    red: "bg-danger/10 text-danger",
    blue: "bg-info/10 text-info",
    amber: "bg-warning/10 text-warning",
    indigo: "bg-primary/10 text-primary",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

// ── Table primitives ─────────────────────────────────────────────────────────
// Shared, consistent styling for every register/report table. `Table` is the
// `<table>` element (wrap it in a scroll container — usually `<Card className="overflow-x-auto">`);
// pass `minWidth` for wide registers. `THead` renders the header row, `TBody` the body.
// `Th`/`Td` are cells with a `right` flag for numeric columns.
export function Table({
  className = "",
  minWidth,
  children,
}: {
  className?: string;
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <table className={`w-full text-sm ${className}`} style={minWidth ? { minWidth } : undefined}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Th({
  children,
  right,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return <th className={`whitespace-nowrap px-3 py-2.5 font-medium ${right ? "text-right" : ""} ${className}`}>{children}</th>;
}

export function Td({
  children,
  right,
  className = "",
  title,
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 ${right ? "text-right" : ""} ${className}`} title={title}>
      {children}
    </td>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 text-muted-foreground ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({
  icon,
  children,
  action,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
      {icon}
      <p>{children}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
