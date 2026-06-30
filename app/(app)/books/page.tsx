"use client";
import { useState } from "react";
import { Banknote, Wallet, Users, NotebookText } from "lucide-react";
import AccountBook from "@/components/AccountBook";
import RojmelBook from "@/components/RojmelBook";

// One unified "Books" hub replacing the separate Bank / Cashbook / Partner / Rojmel pages.
// Each tab is the same payment register for a different account type; Rojmel is the daily
// cash daybook view.
const TABS = [
  { key: "bank", label: "Bank", icon: Banknote },
  { key: "cash", label: "Cashbook", icon: Wallet },
  { key: "partner", label: "Partner", icon: Users },
  { key: "rojmel", label: "Rojmel", icon: NotebookText },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function BooksPage() {
  const [tab, setTab] = useState<TabKey>("bank");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "bank" && <AccountBook accountType="bank" title="Bank Book" />}
      {tab === "cash" && <AccountBook accountType="cash" title="Cashbook (Rojmel)" />}
      {tab === "partner" && <AccountBook accountType="partner" title="Partner Book" />}
      {tab === "rojmel" && <RojmelBook />}
    </div>
  );
}
