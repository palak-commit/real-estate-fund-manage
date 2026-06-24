import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import UIProvider from "@/components/UIProvider";
import ActionsProvider from "@/components/ActionsProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Real Estate Fund Manager",
  description: "Complete visibility of your money across all sites",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <UIProvider>
          <ActionsProvider>
            <Sidebar />
            <div className="lg:pl-60">
              <main className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:px-8 lg:pb-6">{children}</main>
            </div>
            <BottomNav />
          </ActionsProvider>
        </UIProvider>
      </body>
    </html>
  );
}
