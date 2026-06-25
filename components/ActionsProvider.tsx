"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { X, TrendingUp, ArrowDownToLine, MoreHorizontal } from "lucide-react";
import QuickExpenseSheet from "@/components/QuickExpenseSheet";
import AllocateFundsSheet from "@/components/AllocateFundsSheet";
import TransactionForm from "@/components/TransactionForm";

type Ctx = {
  openMenu: () => void;
  recordExpense: (projectId?: number) => void;
  allocateFunds: (projectId?: number) => void;
  openMore: () => void;
};

const ActionsCtx = createContext<Ctx | null>(null);

export function useActions() {
  const ctx = useContext(ActionsCtx);
  if (!ctx) throw new Error("useActions must be used within ActionsProvider");
  return ctx;
}

export default function ActionsProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [expense, setExpense] = useState<{ open: boolean; pid?: number }>({ open: false });
  const [allocate, setAllocate] = useState<{ open: boolean; pid?: number }>({ open: false });
  const [more, setMore] = useState(false);

  const openMenu = useCallback(() => setMenu(true), []);
  const recordExpense = useCallback((pid?: number) => {
    setMenu(false);
    setExpense({ open: true, pid });
  }, []);
  const allocateFunds = useCallback((pid?: number) => {
    setMenu(false);
    setAllocate({ open: true, pid });
  }, []);
  const openMore = useCallback(() => {
    setMenu(false);
    setMore(true);
  }, []);

  return (
    <ActionsCtx.Provider value={{ openMenu, recordExpense, allocateFunds, openMore }}>
      {children}

      {/* Chooser menu */}
      {menu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New</h2>
              <button onClick={() => setMenu(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              <ChoiceButton
                icon={<TrendingUp className="h-5 w-5" />}
                title="Record Expense"
                desc="Log a site spend in seconds"
                onClick={() => recordExpense()}
                accent="bg-danger/10 text-danger"
              />
              <ChoiceButton
                icon={<ArrowDownToLine className="h-5 w-5" />}
                title="Add Site Fund"
                desc="Send money from an account to a site"
                onClick={() => allocateFunds()}
                accent="bg-success/10 text-success"
              />
              <ChoiceButton
                icon={<MoreHorizontal className="h-5 w-5" />}
                title="Other"
                desc="Add money, partner payout, transfer"
                onClick={openMore}
                accent="bg-muted text-muted-foreground"
              />
            </div>
          </div>
        </div>
      )}

      <QuickExpenseSheet open={expense.open} onClose={() => setExpense({ open: false })} presetProjectId={expense.pid} />
      <AllocateFundsSheet open={allocate.open} onClose={() => setAllocate({ open: false })} presetProjectId={allocate.pid} />
      <TransactionForm open={more} onClose={() => setMore(false)} />
    </ActionsCtx.Provider>
  );
}

function ChoiceButton({
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:bg-muted"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
