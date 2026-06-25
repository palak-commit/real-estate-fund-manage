"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

/* ---------------- Toasts ---------------- */
type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

/* ---------------- Confirm ---------------- */
type ConfirmOpts = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type Ctx = {
  toast: (message: string, type?: ToastType) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
};

const UICtx = createContext<Ctx | null>(null);

export function useUI() {
  const ctx = useContext(UICtx);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}

const TOAST_ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const TOAST_STYLE = {
  success: "border-success/30 text-success",
  error: "border-danger/30 text-danger",
  info: "border-info/30 text-info",
};

export default function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const [confirmState, setConfirmState] = useState<
    (ConfirmOpts & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );

  const closeConfirm = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 max-w-[90vw] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-card animate-fade-in ${TOAST_STYLE[t.type]}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1 text-sm text-foreground">{t.message}</p>
              <button
                onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 animate-fade-in"
          onClick={() => closeConfirm(false)}
        >
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  confirmState.danger ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{confirmState.title}</h3>
                {confirmState.message && (
                  <p className="mt-1 text-sm text-muted-foreground">{confirmState.message}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => closeConfirm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {confirmState.cancelText || "Cancel"}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  confirmState.danger ? "bg-danger hover:opacity-90" : "bg-primary hover:opacity-90"
                }`}
              >
                {confirmState.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </UICtx.Provider>
  );
}
