import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// One-click PDF download shared by the registers (RA receipts, Vendor bills). Mirrors
// lib/csv.ts downloadCsv's signature: pass the same headers + rows. Renders a table onto
// an A4 (landscape) page via jspdf-autotable and saves it straight to Downloads — no print
// dialog. Numeric cells are right-aligned with Indian grouping so the sheet reads cleanly.
export function downloadPdf(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  opts?: { subtitle?: string }
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const marginX = 10;

  doc.setFontSize(14);
  doc.text(title, marginX, 14);
  let startY = 20;
  if (opts?.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(opts.subtitle, marginX, 19);
    doc.setTextColor(0);
    startY = 24;
  }

  // A column is numeric if every non-empty cell in it is a number — right-align those.
  const columnStyles: Record<number, { halign: "right" }> = {};
  headers.forEach((_, ci) => {
    const cells = rows.map((r) => r[ci]);
    const hasNumber = cells.some((c) => typeof c === "number");
    const allNumberOrBlank = cells.every((c) => c == null || c === "" || typeof c === "number");
    if (hasNumber && allNumberOrBlank) columnStyles[ci] = { halign: "right" };
  });

  const body = rows.map((r) =>
    r.map((c) => (typeof c === "number" ? c.toLocaleString("en-IN") : String(c ?? "")))
  );

  autoTable(doc, {
    head: [headers],
    body,
    startY,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold", fontSize: 6.5 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles,
  });

  const date = new Date().toISOString().slice(0, 10);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`${slug}-${date}.pdf`);
}
