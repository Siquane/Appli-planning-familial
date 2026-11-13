import PDFDocument from "pdfkit";

// Budget pack: expenses exported for taxes, the CAF or a loan file.
// CSV is made for French spreadsheets (semicolons, decimal comma, UTF-8 BOM so
// Excel reads the accents); the PDF is a printable summary + full list.

export interface ExportRow {
  date: string; // "YYYY-MM-DD"
  label: string;
  category: string; // display name
  member: string; // "" when nobody
  amountCents: number;
  recurring: boolean;
}

export interface ExportData {
  familyName: string;
  from: string; // "YYYY-MM"
  to: string;
  rows: ExportRow[];
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function monthName(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function periodLabel(from: string, to: string) {
  return from === to ? monthName(from) : `${monthName(from)} – ${monthName(to)}`;
}

/** 123456 -> "1 234,56" (plain spaces: the PDF's built-in fonts have no narrow no-break space). */
export function amount(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${euros},${String(abs % 100).padStart(2, "0")}`;
}

const frenchDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

function csvCell(value: string) {
  // Quote when needed; a leading =,+,-,@ would be run as a formula by spreadsheets.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(data: ExportData): string {
  const header = ["Date", "Libellé", "Catégorie", "Pour qui", "Montant (€)", "Récurrente"];
  const lines = data.rows.map((r) =>
    [frenchDate(r.date), r.label, r.category, r.member, amount(r.amountCents).replace(/ /g, ""), r.recurring ? "oui" : "non"].map(csvCell).join(";"),
  );
  return `﻿${[header.join(";"), ...lines].join("\r\n")}\r\n`;
}

export function totalsByCategory(rows: ExportRow[]) {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.category, (totals.get(r.category) ?? 0) + r.amountCents);
  return [...totals.entries()].map(([category, totalCents]) => ({ category, totalCents })).sort((a, b) => b.totalCents - a.totalCents);
}

/** Renders the PDF and resolves with its bytes. */
export function toPdf(data: ExportData, now = new Date()): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Dépenses – ${periodLabel(data.from, data.to)}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const total = data.rows.reduce((s, r) => s + r.amountCents, 0);
  const ink = "#1f2430";
  const muted = "#6b7080";
  const rule = "#d9dbe1";

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(18).text("Relevé des dépenses");
  doc.moveDown(0.2).font("Helvetica").fontSize(11).fillColor(muted);
  doc.text(`${data.familyName} · ${periodLabel(data.from, data.to)}`);
  doc.text(`Édité le ${frenchDate(now.toISOString().slice(0, 10))} · ${data.rows.length} dépense${data.rows.length > 1 ? "s" : ""}`);

  doc.moveDown(1).fillColor(ink).font("Helvetica-Bold").fontSize(13).text(`Total : ${amount(total)} €`);

  // Totals by category
  doc.moveDown(0.8).fontSize(12).text("Par catégorie");
  doc.moveDown(0.3).font("Helvetica").fontSize(10);
  for (const c of totalsByCategory(data.rows)) {
    const y = doc.y;
    doc.fillColor(ink).text(c.category, left, y, { width: width - 120 });
    doc.text(`${amount(c.totalCents)} €`, left + width - 120, y, { width: 120, align: "right" });
    doc.moveDown(0.15);
  }

  // Full list
  const cols = [
    { title: "Date", w: 62, align: "left" as const },
    { title: "Libellé", w: width - 62 - 110 - 80 - 76, align: "left" as const },
    { title: "Catégorie", w: 110, align: "left" as const },
    { title: "Pour qui", w: 80, align: "left" as const },
    { title: "Montant (€)", w: 76, align: "right" as const },
  ];
  const drawHeader = () => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(muted);
    let x = left;
    for (const c of cols) {
      doc.text(c.title, x, y, { width: c.w - 4, align: c.align });
      x += c.w;
    }
    doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).strokeColor(rule).lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  };

  doc.moveDown(1).font("Helvetica-Bold").fontSize(12).fillColor(ink).text("Détail", left);
  doc.moveDown(0.3);
  drawHeader();
  doc.font("Helvetica").fontSize(9).fillColor(ink);
  const bottom = doc.page.height - doc.page.margins.bottom - 14;
  for (const r of data.rows) {
    const cells = [frenchDate(r.date), r.recurring ? `${r.label} (récurrente)` : r.label, r.category, r.member, amount(r.amountCents)];
    const rowHeight = Math.max(...cells.map((t, i) => doc.heightOfString(t, { width: cols[i].w - 4 })));
    if (doc.y + rowHeight > bottom) {
      doc.addPage();
      drawHeader();
      doc.font("Helvetica").fontSize(9).fillColor(ink);
    }
    const y = doc.y;
    let x = left;
    cells.forEach((t, i) => {
      doc.text(t, x, y, { width: cols[i].w - 4, align: cols[i].align });
      x += cols[i].w;
    });
    doc.y = y + rowHeight + 3;
  }
  if (data.rows.length === 0) doc.fillColor(muted).text("Aucune dépense sur cette période.", left);

  doc.end();
  return done;
}
