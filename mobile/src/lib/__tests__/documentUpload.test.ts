import { documentsApi } from "../../api/resources";
import { formatSize, guessMimeType, MAX_FILE_SIZE, uploadPickedFile, UploadError, validateFile } from "../documentUpload";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("../../api/resources", () => ({
  documentsApi: { create: jest.fn(), confirm: jest.fn(), remove: jest.fn() },
}));

const api = documentsApi as jest.Mocked<typeof documentsApi>;

describe("guessMimeType", () => {
  it("keeps a reported type, normalising image/jpg", () => {
    expect(guessMimeType("a.bin", "application/pdf")).toBe("application/pdf");
    expect(guessMimeType("a.jpg", "image/jpg")).toBe("image/jpeg");
  });

  it("falls back on the extension when the picker reports nothing useful", () => {
    expect(guessMimeType("Ordonnance.PDF")).toBe("application/pdf");
    expect(guessMimeType("photo.heic", "application/octet-stream")).toBe("image/heic");
  });
});

describe("validateFile", () => {
  it("accepts photos and PDFs up to 5 Mo", () => {
    expect(validateFile("application/pdf", MAX_FILE_SIZE)).toBeNull();
    expect(validateFile("image/jpeg", 1000)).toBeNull();
  });

  it("explains why a file is refused", () => {
    expect(validateFile("application/zip", 10)).toMatch(/photos et les PDF/);
    expect(validateFile("application/pdf", MAX_FILE_SIZE + 1)).toMatch(/5 Mo/);
  });
});

describe("formatSize", () => {
  it("formats bytes in French units", () => {
    expect(formatSize(500)).toBe("500 o");
    expect(formatSize(2048)).toBe("2 Ko");
    expect(formatSize(1.5 * 1024 * 1024)).toBe("1,5 Mo");
  });
});

describe("uploadPickedFile", () => {
  const file = { uri: "file:///cache/ordonnance.pdf", name: "ordonnance.pdf", mimeType: "application/pdf" };
  const blob = { size: 1234 };
  const ticket = {
    document: { id: "doc1" },
    upload: { url: "https://bucket.test/signed", method: "PUT" as const, headers: { "Content-Type": "application/pdf" } },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it("asks for a signed URL, sends the bytes there, then confirms", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ blob: async () => blob }).mockResolvedValueOnce({ ok: true });
    api.create.mockResolvedValue(ticket as never);
    api.confirm.mockResolvedValue({ document: { id: "doc1", title: "ordonnance" } } as never);

    const doc = await uploadPickedFile(file, { category: "santé" });

    expect(api.create).toHaveBeenCalledWith({ category: "santé", fileName: "ordonnance.pdf", mimeType: "application/pdf", size: 1234 });
    expect(global.fetch).toHaveBeenLastCalledWith("https://bucket.test/signed", { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: blob });
    expect(api.confirm).toHaveBeenCalledWith("doc1");
    expect(doc.id).toBe("doc1");
  });

  it("refuses a too-large file before contacting the API", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ blob: async () => ({ size: MAX_FILE_SIZE + 1 }) });
    await expect(uploadPickedFile(file, {})).rejects.toBeInstanceOf(UploadError);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("drops the pending document when the bucket upload fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ blob: async () => blob }).mockResolvedValueOnce({ ok: false });
    api.create.mockResolvedValue(ticket as never);
    api.remove.mockResolvedValue(undefined);

    await expect(uploadPickedFile(file, {})).rejects.toThrow(/envoi du fichier a échoué/);
    expect(api.remove).toHaveBeenCalledWith("doc1");
    expect(api.confirm).not.toHaveBeenCalled();
  });
});
