import { getDocumentProxy } from "unpdf";
import type { TextItem } from "./statementParser";

export const MAX_STATEMENT_BYTES = 6 * 1024 * 1024;
const MAX_PAGES = 40;

export class StatementReadError extends Error {}

/**
 * Text of every page with its position. Everything stays in memory: the file
 * is never written anywhere, and the caller drops it right after.
 */
export async function readPdfItems(data: Uint8Array): Promise<TextItem[][]> {
  let pdf;
  try {
    pdf = await getDocumentProxy(data);
  } catch {
    throw new StatementReadError("Ce fichier n'est pas un PDF lisible. Vérifie qu'il n'est pas protégé par un mot de passe.");
  }
  if (pdf.numPages > MAX_PAGES) throw new StatementReadError("Ce relevé est trop long (40 pages au plus).");
  const pages: TextItem[][] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .filter((it): it is typeof it & { str: string; transform: number[]; width: number } => "str" in it)
          .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width })),
      );
    }
  } finally {
    // Free the parsed document (older builds may not expose it).
    await (pdf as unknown as { cleanup?: () => Promise<void> }).cleanup?.();
  }
  return pages;
}
