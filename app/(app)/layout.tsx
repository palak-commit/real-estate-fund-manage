import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import UIProvider from "@/components/UIProvider";
import ActionsProvider from "@/components/ActionsProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <ActionsProvider>
        <Sidebar />
        <div className="lg:pl-60">
          <main className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:px-8 lg:pb-6">{children}</main>
        </div>
        <BottomNav />
      </ActionsProvider>
    </UIProvider>
  );
}
