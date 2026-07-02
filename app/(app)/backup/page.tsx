"use client";
import { useEffect, useState } from "react";
import { Database, Download, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { Card, Button, Table, THead, TBody, Th, Td, Skeleton } from "@/components/ui";
import { useUI } from "@/components/UIProvider";

type Meta = { tables: { name: string; rows: number }[]; totalRows: number };

export default function BackupPage() {
  const { toast } = useUI();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/backup?meta=1")
      .then((r) => r.json())
      .then((j) => setMeta(j.data ?? null))
      .catch(() => setMeta({ tables: [], totalRows: 0 }));
    setLastAt(typeof window !== "undefined" ? localStorage.getItem("lastBackupAt") : null);
  }, []);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      // Pull the server-provided filename from the Content-Disposition header.
      const cd = res.headers.get("Content-Disposition") || "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] || "fund-manager-backup.sql";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const now = new Date().toLocaleString();
      localStorage.setItem("lastBackupAt", now);
      setLastAt(now);
      toast("Backup downloaded", "success");
    } catch {
      toast("Could not generate backup. Please try again.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Database className="h-6 w-6 text-muted-foreground" /> Backup
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Download a complete copy of all your data as a single <strong>.sql</strong> file. Keep it somewhere safe —
          it can restore everything if data is ever lost.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Download a full backup</p>
              <p className="text-sm text-muted-foreground">
                Everything — accounts, sites, transactions, RA receipts, vendor bills — in one file.
              </p>
              {lastAt && <p className="mt-1 text-xs text-muted-foreground">Last download on this device: {lastAt}</p>}
            </div>
          </div>
          <Button onClick={download} loading={downloading} className="shrink-0">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Preparing…" : "Download Backup (.sql)"}
          </Button>
        </div>
      </Card>

      {/* What's included */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">What's included</h2>
        </div>
        {!meta ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : meta.tables.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No data to back up yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Th>Table</Th>
                <Th right>Records</Th>
              </THead>
              <TBody>
                {meta.tables.map((t) => (
                  <tr key={t.name}>
                    <Td className="font-medium">{t.name}</Td>
                    <Td right>{t.rows.toLocaleString()}</Td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <Td>Total records</Td>
                  <Td right>{meta.totalRows.toLocaleString()}</Td>
                </tr>
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      {/* How to restore */}
      <Card className="border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900/90">
            <p className="font-semibold text-amber-900">How to restore this file</p>
            <p className="mt-1">
              The <strong>.sql</strong> file rebuilds every table and all rows. To restore, import it into a MySQL
              database (e.g. your IT person runs it via MySQL, or:)
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-amber-100/70 p-2 text-xs text-amber-900">
mysql -u USER -p DBNAME &lt; fund-manager-backup-….sql
            </pre>
            <p className="mt-2 text-xs text-amber-900/70">
              Tip: download a backup regularly (e.g. at month-end) and keep copies in more than one place — a backup
              stored only on this computer won't help if the computer is lost.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
