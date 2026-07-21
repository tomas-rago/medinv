"use client";

// Client-side file generation for the movements report. The heavy libraries
// (xlsx, jspdf) are loaded via dynamic import() on first use so they never
// enter the initial page bundle or the server build.

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportMovementsCsv(headers: string[], rows: string[][], filename: string) {
  // BOM so Excel decodes UTF-8 (áéñ…) correctly; CRLF for Windows Excel.
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportMovementsXlsx(headers: string[], rows: string[][], filename: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = headers.map((h, i) => ({
    wch: Math.min(40, Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)) + 2),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportMovementsPdf(
  headers: string[],
  rows: string[][],
  filename: string,
  title: string
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  doc.setFontSize(12);
  doc.text(title, 14, 12);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 16,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [41, 111, 99] },
  });
  doc.save(`${filename}.pdf`);
}
