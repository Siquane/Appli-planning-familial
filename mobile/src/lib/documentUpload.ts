import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { documentsApi } from "../api/resources";
import type { DocumentCategory, DocumentInput, FamilyDocument } from "../api/types";

// Must match server/src/lib/storage.ts (MAX_FILE_SIZE) and the accepted types
// in server/src/routes/documents.ts.
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "santé", label: "Santé" },
  { value: "assurance", label: "Assurance" },
  { value: "école", label: "École" },
  { value: "administratif", label: "Administratif" },
  { value: "maison", label: "Maison" },
  { value: "autre", label: "Autre" },
];

export function categoryLabel(category: DocumentCategory) {
  return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export type PickSource = "camera" | "photos" | "files";

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export class UploadError extends Error {}

const EXTENSION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Pickers don't always report a MIME type — fall back on the extension. */
export function guessMimeType(name: string, reported?: string | null): string {
  if (reported && reported !== "application/octet-stream") return reported === "image/jpg" ? "image/jpeg" : reported;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? reported ?? "application/octet-stream";
}

/** French, human-readable reason the file can't be sent, or null if it's fine. */
export function validateFile(mimeType: string, size: number): string | null {
  if (!ACCEPTED_TYPES.includes(mimeType)) return "Seuls les photos et les PDF sont acceptés.";
  if (size > MAX_FILE_SIZE) return `Ce fichier fait ${formatSize(size)} : la limite est de 5 Mo.`;
  return null;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export function isImage(doc: Pick<FamilyDocument, "mimeType">) {
  return doc.mimeType.startsWith("image/");
}

/** Opens the camera, the photo library or the file picker. Null if cancelled. */
export async function pickFile(source: PickSource): Promise<PickedFile | null> {
  if (source === "files") {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return null;
    const a = result.assets[0];
    return { uri: a.uri, name: a.name, mimeType: guessMimeType(a.name, a.mimeType), size: a.size };
  }

  const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new UploadError(source === "camera" ? "L'accès à l'appareil photo a été refusé." : "L'accès aux photos a été refusé.");
  }
  // quality < 1 re-encodes to JPEG, which keeps phone photos well under 5 Mo.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const name = a.fileName ?? `photo-${Date.now()}.jpg`;
  return { uri: a.uri, name, mimeType: guessMimeType(name, a.mimeType), size: a.fileSize };
}

/**
 * Sends the file straight to the bucket: ask the API for a signed URL, PUT the
 * bytes there, then let the API check the stored file and publish the row.
 */
export async function uploadPickedFile(file: PickedFile, data: DocumentInput): Promise<FamilyDocument> {
  const blob = await (await fetch(file.uri)).blob();
  const size = blob.size || file.size || 0;
  const problem = validateFile(file.mimeType, size);
  if (problem) throw new UploadError(problem);

  const ticket = await documentsApi.create({ ...data, fileName: file.name, mimeType: file.mimeType, size });
  const put = await fetch(ticket.upload.url, { method: ticket.upload.method, headers: ticket.upload.headers, body: blob });
  if (!put.ok) {
    await documentsApi.remove(ticket.document.id).catch(() => {});
    throw new UploadError("L'envoi du fichier a échoué. Vérifiez votre connexion et réessayez.");
  }
  const { document } = await documentsApi.confirm(ticket.document.id);
  return document;
}
