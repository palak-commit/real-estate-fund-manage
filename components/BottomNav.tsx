"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, BarChart3, Building2, Plus } from "lucide-react";
import { useActions } from "@/components/ActionsProvider";

const LEFT = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Activity", icon: Receipt },
];
const RIGHT = [
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/projects", label: "Sites", icon: Building2 },
];

export default function BottomNav() {
  const path = usePathname();
  const { openMenu } = useActions();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const item = (l: { href: string; label: string; icon: any }) => {
    const Icon = l.icon;
    const active = isActive(l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
        {l.label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-border bg-card/95 backdrop-blur lg:hidden">
      {LEFT.map(item)}
      <div className="flex flex-1 justify-center">
        <button
          onClick={openMenu}
          aria-label="New"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      {RIGHT.map(item)}
    </nav>
  );
}
