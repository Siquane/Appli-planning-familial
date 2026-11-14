// Reads the text of a bank statement (PDF) into expense lines.
//
// Works on text items with their position on the page, so it can tell the
// « Débit » column from the « Crédit » one the way a person does. Pure
// functions: the PDF itself is read in statementPdf.ts, and nothing here
// stores or logs what it reads.

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

export interface ParsedRow {
  /** YYYY-MM-DD */
  date: string;
  label: string;
  /** Extra lines under the operation (mandate, reference…), cleaned; used to classify, never an identifier. */
  detail: string;
  /** « carte », « prlv », « virement », « avoir »… (lower case, no accents), or "". */
  kind: string;
  /** Always positive. */
  amountCents: number;
  /** True for money coming in. */
  credit: boolean;
}

export interface ParsedStatement {
  rows: ParsedRow[];
  /** « Total des opérations » of the statement, when it has one: lets the caller check nothing was missed. */
  expectedDebitsCents: number | null;
  expectedCreditsCents: number | null;
}

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const DATE_RE = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/;
// 1 234,56 · 1.234,56 · 12,50 · -12,50 · 12,50- · +12,50 · 12.50
const AMOUNT_RE = /^[-+−]?\s?\d{1,3}(?:[ .  ]\d{3})*(?:,\d{2})[-+]?$|^[-+−]?\d+[,.]\d{2}[-+]?$/;
const KINDS = /^(carte|prlv|prelevement|virement|vir|avoir|cheque|retrait|cotisation|commission|remise|frais|paiement|achat|cb)$/i;

/** « 1 234,56 » → 123456. Returns null when it isn't an amount. */
export function parseAmountCents(raw: string): { cents: number; sign: -1 | 0 | 1 } | null {
  const s = raw.trim();
  if (!AMOUNT_RE.test(s)) return null;
  // « 05.10 » is a date, not 5,10 €.
  const asDate = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (asDate && Number(asDate[1]) >= 1 && Number(asDate[1]) <= 31 && Number(asDate[2]) >= 1 && Number(asDate[2]) <= 12) return null;
  const neg = /^[-−]/.test(s) || /-$/.test(s);
  const pos = /^\+/.test(s) || /\+$/.test(s);
  let digits = s.replace(/[-+−\s  ]/g, "");
  if (digits.includes(",")) digits = digits.replace(/\./g, "").replace(",", ".");
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return { cents: Math.round(value * 100), sign: neg ? -1 : pos ? 1 : 0 };
}

/** Groups items of one page into lines (top to bottom), each sorted left to right. */
export function groupLines(items: TextItem[], tolerance = 2.5): TextItem[][] {
  const sorted = items.filter((i) => i.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: TextItem[] }[] = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tolerance);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((l) => l.items.sort((a, b) => a.x - b.x));
}

const lineText = (line: TextItem[]) => line.map((i) => i.str.trim()).join(" ");
const norm = (s: string) => stripAccents(s).toLowerCase();

/** The date the statement is « as of » (« Date d'arrêté : 02 Novembre 2026 », « au 02.11.2026 »), to place dd.mm dates in a year. */
export function findReferenceDate(texts: string[], fallback: Date): Date {
  const all = norm(texts.join("\n"));
  const long = all.match(/arrete\s*:?\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (long) {
    const m = MONTHS.indexOf(long[2]);
    if (m >= 0) return new Date(Date.UTC(Number(long[3]), m, Number(long[1])));
  }
  const dates = [...all.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/g)].map((m) => new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))));
  if (dates.length > 0) return new Date(Math.max(...dates.map((d) => d.getTime())));
  return fallback;
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** dd.mm (or dd/mm/yy…) → a calendar day on or before the reference date. */
function resolveDate(day: number, month: number, year: string | undefined, reference: Date): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let y: number;
  if (year) y = year.length === 2 ? 2000 + Number(year) : Number(year);
  else y = month > reference.getUTCMonth() + 1 || (month === reference.getUTCMonth() + 1 && day > reference.getUTCDate() + 3) ? reference.getUTCFullYear() - 1 : reference.getUTCFullYear();
  const d = new Date(Date.UTC(y, month - 1, day));
  return d.getUTCMonth() === month - 1 ? ymd(d) : null;
}

const NOISE = [
  /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{2,}(?:\s?[A-Z0-9]{2,}){2,}\b/g, // IBAN-like
  /\bFR\d{2}ZZZ\w+/gi, // SEPA creditor id
  /\bREF-?\w{8,}\b/gi,
  /\b\w*\d{6,}\w*\b/g, // long numbers, mandates, references
  /\bCore\b/g,
  /\bB2B\b/g,
];

function cleanDetail(parts: string[]) {
  let text = parts.join(" ");
  for (const re of NOISE) text = text.replace(re, " ");
  return text.replace(/\s+/g, " ").trim().slice(0, 140);
}

/** Cleans the main label: card number, trailing card date, repeated spaces. Returns the card date (dd, mm) if any. */
function cleanLabel(raw: string): { label: string; cardDay?: number; cardMonth?: number } {
  let label = raw.replace(/\s+/g, " ").trim();
  label = label.replace(/^(?:carte\s+)?x\d{4}\s+/i, "");
  let cardDay: number | undefined;
  let cardMonth: number | undefined;
  const m = label.match(/\s(\d{2})\/(\d{2})$/);
  if (m) {
    cardDay = Number(m[1]);
    cardMonth = Number(m[2]);
    label = label.slice(0, m.index).trim();
  }
  return { label: label.slice(0, 90), cardDay, cardMonth };
}

/**
 * @param pages  text items of each page
 * @param today  used for the year when the statement doesn't say it
 */
export function parseStatement(pages: TextItem[][], today: Date = new Date()): ParsedStatement {
  const pageLines = pages.map((p) => groupLines(p));
  const reference = findReferenceDate(
    pageLines.flatMap((ls) => ls.map(lineText)),
    today,
  );

  // Right edges of the « Débit » / « Crédit » column titles, remembered across pages.
  let debitRight: number | null = null;
  let creditRight: number | null = null;
  // Without those titles: in statements where debits carry a « - », an unsigned amount is a credit.
  const documentUsesMinus = pageLines.flat().some((l) => l.some((i) => /^[-−]\s?\d/.test(i.str.trim()) && AMOUNT_RE.test(i.str.trim())));

  const rows: ParsedRow[] = [];
  let current: { row: ParsedRow; details: string[] } | null = null;
  let expectedDebitsCents: number | null = null;
  let expectedCreditsCents: number | null = null;

  const flush = () => {
    if (current) {
      current.row.detail = cleanDetail(current.details.slice(0, 3));
      rows.push(current.row);
      current = null;
    }
  };

  for (const lines of pageLines) {
    for (const line of lines) {
      const texts = line.map((i) => i.str.trim());
      const joined = norm(texts.join(" "));

      // Column titles.
      const debitTitle = line.find((i) => norm(i.str).trim() === "debit");
      const creditTitle = line.find((i) => norm(i.str).trim() === "credit");
      if (debitTitle && creditTitle) {
        debitRight = debitTitle.x + debitTitle.width;
        creditRight = creditTitle.x + creditTitle.width;
        flush();
        continue;
      }

      // Totals line: closes the list of operations.
      if (/total des operations/.test(joined)) {
        flush();
        const amounts = line.filter((i) => parseAmountCents(i.str));
        for (const a of amounts) {
          const cents = parseAmountCents(a.str)!.cents;
          if (debitRight !== null && creditRight !== null) {
            const right = a.x + a.width;
            if (Math.abs(right - debitRight) <= Math.abs(right - creditRight)) expectedDebitsCents = cents;
            else expectedCreditsCents = cents;
          } else expectedDebitsCents = cents;
        }
        continue;
      }
      if (/nouveau solde|solde crediteur au|solde debiteur au|ancien solde/.test(joined)) {
        flush();
        continue;
      }

      // An operation starts with its date.
      const first = line[0];
      const dm = first ? first.str.trim().match(DATE_RE) : null;
      if (dm) {
        flush();
        const opDate = resolveDate(Number(dm[1]), Number(dm[2]), dm[3], reference);
        if (!opDate) continue;

        let rest = line.slice(1);
        // Value date, right after the operation date.
        if (rest[0] && DATE_RE.test(rest[0].str.trim())) rest = rest.slice(1);

        // Amounts: with column titles, anything amount-like in the amount zone; otherwise the last one.
        const isAmount = (i: TextItem) => parseAmountCents(i.str) !== null;
        let amountItems: TextItem[];
        if (debitRight !== null && creditRight !== null) {
          const zoneStart = debitRight - 60;
          amountItems = rest.filter((i) => isAmount(i) && i.x + i.width >= zoneStart);
        } else {
          const all = rest.filter(isAmount);
          amountItems = all.length ? [all[all.length - 1]] : [];
        }
        if (amountItems.length === 0) continue;
        const amountItem = amountItems[amountItems.length - 1];
        const parsed = parseAmountCents(amountItem.str)!;
        let credit: boolean;
        if (debitRight !== null && creditRight !== null) {
          const right = amountItem.x + amountItem.width;
          credit = Math.abs(right - creditRight) < Math.abs(right - debitRight);
        } else if (parsed.sign !== 0) credit = parsed.sign > 0;
        else credit = documentUsesMinus;

        // Label = everything else except stray marks (« ¨ », « þ »…).
        const labelItems = rest.filter((i) => !amountItems.includes(i) && /[\p{L}\p{N}]/u.test(i.str));
        let kind = "";
        if (labelItems.length > 1 && KINDS.test(labelItems[0].str.trim())) kind = norm(labelItems.shift()!.str.trim());
        let text = labelItems.map((i) => i.str.trim()).join(" ");
        if (!kind) {
          // Some statements run the type into the label in one block of text.
          const glued = text.match(/^(\S+)\s+(.+)$/);
          if (glued && KINDS.test(glued[1])) {
            kind = norm(glued[1]);
            text = glued[2];
          }
        }
        const { label, cardDay, cardMonth } = cleanLabel(text);
        if (!label) continue;

        // A card payment made a few days before it was booked: use the day of the purchase.
        let date = opDate;
        if (cardDay && cardMonth) {
          const purchase = resolveDate(cardDay, cardMonth, undefined, new Date(`${opDate}T00:00:00Z`));
          if (purchase && purchase <= opDate && Date.parse(opDate) - Date.parse(purchase) <= 7 * 86_400_000) date = purchase;
        }

        current = { row: { date, label, detail: "", kind, amountCents: parsed.cents, credit }, details: [] };
        continue;
      }

      // A line without date under an operation: extra details (mandate, reference…).
      if (current && current.details.length < 4) {
        const body = line.filter((i) => !isPageMark(i.str)).map((i) => i.str.trim());
        const text = body.join(" ");
        if (text && !/\(suite\)|^page\b|releve de comptes|date d'arret/i.test(norm(text)) && !line.some((i) => parseAmountCents(i.str))) current.details.push(text);
      }
    }
  }
  flush();
  return { rows, expectedDebitsCents, expectedCreditsCents };
}

function isPageMark(s: string) {
  return !/[\p{L}\p{N}]/u.test(s);
}

/** Stable key for a label: the merchant, without card numbers, dates or digits. Used for rules and duplicate checks. */
export function labelKey(label: string): string {
  const words = norm(label)
    .replace(/\bx\d{4}\b/g, " ")
    .replace(/\d{2}\/\d{2}/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !["sa", "sas", "sarl", "de", "du", "des", "la", "le", "les", "et", "paiement", "prelevement", "prlv", "sepa", "carte", "cb", "web", "vir", "virement", "avoir", "achat"].includes(w));
  return words.slice(0, 3).join(" ");
}
