"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Building2,
  Landmark,
  Activity,
  Menu,
  X,
  Plus,
  LogOut,
  Home as HomeIcon,
  BookOpen,
  Banknote,
  Tag,
  FileText,
  ClipboardList,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useActions } from "@/components/ActionsProvider";

const PRIMARY = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/projects", label: "Sites", icon: Building2 },
  { href: "/heads", label: "Expense Heads", icon: Tag },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/guide", label: "User Guide", icon: BookOpen },
];
const MANAGE = [
  { href: "/books", label: "Expenses", icon: Banknote },
  { href: "/ra-receipts", label: "Receipt of RA", icon: FileText },
  { href: "/vendor-bills", label: "Vendor Bills", icon: ClipboardList },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { openMore } = useActions();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  // "Manage" is a collapsible dropdown. It opens automatically whenever the current page is
  // one of its items, and can be toggled by hand.
  const manageActive = MANAGE.some((m) => isActive(m.href));
  const [manageOpen, setManageOpen] = useState(manageActive);
  useEffect(() => {
    if (manageActive) setManageOpen(true);
  }, [manageActive]);

  const navLink = (l: { href: string; label: string; icon: any }) => {
    const Icon = l.icon;
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive(l.href) ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
        {l.label}
      </Link>
    );
  };

  const Body = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <HomeIcon className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Fund Manager</p>
          <p className="text-[11px] text-white/50">Real Estate</p>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={() => {
            openMore();
            setOpen(false);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Transaction
        </button>
      </div>

      <div className="mt-4 flex-1 px-3">
        <nav className="space-y-1">{PRIMARY.map(navLink)}</nav>

        {/* Section label after the primary items. */}
        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Manage</p>

        {/* Manage — collapsible dropdown revealing its sub-items. */}
        <div>
          <button
            onClick={() => setManageOpen((v) => !v)}
            aria-expanded={manageOpen}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              manageActive ? "text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <Settings className="h-[18px] w-[18px]" />
              Manage
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${manageOpen ? "rotate-180" : ""}`} />
          </button>
          {manageOpen && (
            <nav className="mt-1 space-y-1 border-l border-white/10 pl-3">{MANAGE.map(navLink)}</nav>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
            A
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium text-white">Admin</p>
            <p className="truncate text-[11px] text-white/50">Signed in</p>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar lg:block">{Body}</aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="text-white" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <HomeIcon className="h-4 w-4" /> Fund Manager
        </span>
        <span className="w-5" />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-white/60 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            {Body}
          </aside>
        </div>
      )}
    </>
  );
}
