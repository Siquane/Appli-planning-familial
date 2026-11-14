import PDFDocument from "pdfkit";

// A fake « Débit / Crédit » bank statement (invented data, same layout idea as
// real ones: dates on the left, label in the middle, two amount columns on the
// right, detail lines without date, a « Total des opérations » line).

export interface FakeLine {
  date: string; // "05.10"
  kind: string;
  label: string;
  debit?: string; // "74,48"
  credit?: string;
  detail?: string;
}

export const FAKE_LINES: FakeLine[] = [
  { date: "03.10", kind: "Virement", label: "Mairie Cantine", credit: "20,00" },
  { date: "05.10", kind: "Carte", label: "X1234 Carrefour City Lyon 03/10", debit: "74,48" },
  { date: "05.10", kind: "Carte", label: "X1234 Burger King Vaulx 04/10", debit: "35,10" },
  { date: "06.10", kind: "Prlv", label: "Canal+ France", debit: "22,99", detail: "Prlv Canal Abonnement mensuel FR90ZZZ397351 Core" },
  { date: "07.10", kind: "Virement", label: "Web Jean Martin", debit: "650,00", detail: "Loyer Charges 3 rue des Lilas" },
  { date: "08.10", kind: "Prlv", label: "Engie", debit: "104,21", detail: "Mandat 00S1234567890 FR03SYM002381 Core" },
  { date: "09.10", kind: "Avoir", label: "Carte X1234 Amazon Payment 08/10", credit: "33,99" },
  { date: "10.10", kind: "Carte", label: "X1234 Mystere Boutique 09/10", debit: "1 234,56" },
];

export const FAKE_DEBITS_TOTAL_CENTS = 7448 + 3510 + 2299 + 65000 + 10421 + 123456;
export const FAKE_CREDITS_TOTAL_CENTS = 2000 + 3399;

export function fakeStatementPdf(lines: FakeLine[] = FAKE_LINES): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const right = (text: string, rightEdge: number, y: number) => {
      doc.text(text, rightEdge - doc.widthOfString(text), y, { lineBreak: false });
    };
    doc.fontSize(9);
    doc.text("RELEVE DE COMPTES EN EUROS N° 011", 335, 30, { lineBreak: false });
    doc.text("Date d'arrêté : 02 Novembre 2026", 388, 44, { lineBreak: false });
    doc.text("Date", 20, 100, { lineBreak: false });
    doc.text("Libellé des opérations", 79, 100, { lineBreak: false });
    doc.text("Débit", 437, 100, { lineBreak: false });
    doc.text("Crédit", 519, 100, { lineBreak: false });
    let y = 125;
    for (const l of lines) {
      doc.text(l.date, 19, y, { lineBreak: false });
      doc.text(l.date, 50, y, { lineBreak: false });
      doc.text(l.kind, 79, y, { lineBreak: false });
      doc.text(l.label, 117, y, { lineBreak: false });
      if (l.debit) right(l.debit, 457, y);
      if (l.credit) right(l.credit, 541, y);
      y += 14;
      if (l.detail) {
        doc.text(l.detail, 80, y, { lineBreak: false });
        y += 14;
      }
    }
    const debits = lines.reduce((s, l) => s + (l.debit ? Number(l.debit.replace(/\s/g, "").replace(",", ".")) : 0), 0);
    const credits = lines.reduce((s, l) => s + (l.credit ? Number(l.credit.replace(/\s/g, "").replace(",", ".")) : 0), 0);
    const fmt = (n: number) => n.toFixed(2).replace(".", ",");
    doc.text("Total des opérations", 289, y + 10, { lineBreak: false });
    right(fmt(debits), 457, y + 10);
    right(fmt(credits), 541, y + 10);
    doc.end();
  });
}
