import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL, api } from "../api/client";
import { useAuthStore } from "../state/authStore";
import { currentMonth, shiftMonth } from "./money";

export type ExportFormat = "csv" | "pdf";

export const EXPORT_PERIODS = [
  { id: "month", label: "Ce mois-ci" },
  { id: "3months", label: "3 derniers mois" },
  { id: "year", label: "Cette année" },
  { id: "lastYear", label: "L'année dernière" },
] as const;
export type ExportPeriod = (typeof EXPORT_PERIODS)[number]["id"];

/** [from, to] months ("YYYY-MM") for a period, relative to `now`. */
export function periodRange(period: ExportPeriod, now = currentMonth()): [string, string] {
  const year = Number(now.slice(0, 4));
  switch (period) {
    case "month":
      return [now, now];
    case "3months":
      return [shiftMonth(now, -2), now];
    case "year":
      return [`${year}-01`, now];
    case "lastYear":
      return [`${year - 1}-01`, `${year - 1}-12`];
  }
}

const MIME: Record<ExportFormat, { mimeType: string; UTI: string }> = {
  csv: { mimeType: "text/csv", UTI: "public.comma-separated-values-text" },
  pdf: { mimeType: "application/pdf", UTI: "com.adobe.pdf" },
};

/**
 * Downloads the export from the API into the cache, then opens the phone's
 * share sheet (mail, Drive, WhatsApp, Fichiers…).
 */
export async function exportExpenses(period: ExportPeriod, format: ExportFormat) {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  }
  // A cheap authenticated call first: it refreshes an expired session, so the
  // download below (which bypasses the API client) carries a valid token.
  await api.get("/plan");
  const token = useAuthStore.getState().accessToken;
  const [from, to] = periodRange(period);
  const name = `depenses-${from}${from === to ? "" : `-${to}`}.${format}`;
  const destination = new File(Paths.cache, name);
  let file: File;
  try {
    file = await File.downloadFileAsync(`${API_URL}/expenses/export?from=${from}&to=${to}&format=${format}`, destination, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotent: true,
    });
  } catch {
    throw new Error("L'export a échoué. Vérifie ta connexion et réessaie.");
  }
  await Sharing.shareAsync(file.uri, { ...MIME[format], dialogTitle: "Exporter les dépenses" });
}
