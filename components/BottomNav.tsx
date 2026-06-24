"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  Landmark,
  Receipt,
  Plus,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useActions } from "@/components/ActionsProvider";

const LEFT = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
];
const RIGHT = [{ href: "/reports", label: "Reports", icon: BarChart3 }];
const MORE = [
  { href: "/projects", label: "Sites", icon: Building2 },
  { href: "/accounts", label: "Accounts", icon: Landmark },
];

export default function BottomNav() {
  const path = usePathname();
  const { openMenu } = useActions();
  const [more, setMore] = useState(false);
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

  const moreActive = MORE.some((m) => isActive(m.href));

  return (
    <>
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
        <button
          onClick={() => setMore(true)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
            moreActive ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-4 pb-6 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">More</h2>
              <button onClick={() => setMore(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {MORE.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMore(false)}
                    className="flex items-center gap-3 py-3 text-sm font-medium"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
