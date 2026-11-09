import { DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, isStorageConfigured } from "../env";

// Files never transit through the API: the app gets a short-lived signed URL
// and talks to the bucket directly (PUT to upload, GET to view). The bucket
// stays private — family documents (prescriptions, insurance…) are never
// reachable without a fresh signed link.

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo
export const UPLOAD_URL_TTL = 10 * 60; // 10 min to send the file
export const DOWNLOAD_URL_TTL = 60 * 60; // 1 h to view it

export interface Storage {
  /** Signed PUT URL; the client must send exactly this Content-Type. */
  uploadUrl(key: string, mimeType: string): Promise<string>;
  /** Signed GET URL, valid DOWNLOAD_URL_TTL seconds. */
  downloadUrl(key: string, fileName: string): Promise<string>;
  /** Size in bytes of the stored object, or null if it does not exist. */
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
}

class S3Storage implements Storage {
  private client = new S3Client({
    region: env.storage.region,
    endpoint: env.storage.endpoint || undefined,
    credentials: { accessKeyId: env.storage.accessKeyId, secretAccessKey: env.storage.secretAccessKey },
    // R2 (and other S3-compatible hosts) expect bucket-in-path URLs.
    forcePathStyle: !!env.storage.endpoint,
    // Otherwise the SDK signs a CRC32 of an *empty* body into presigned PUT
    // URLs, and the real upload is then rejected for checksum mismatch.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  private bucket = env.storage.bucket;

  uploadUrl(key: string, mimeType: string) {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType }), { expiresIn: UPLOAD_URL_TTL });
  }

  downloadUrl(key: string, fileName: string) {
    const disposition = `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition }), {
      expiresIn: DOWNLOAD_URL_TTL,
    });
  }

  async size(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return head.ContentLength ?? 0;
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw e;
    }
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let override: Storage | null | undefined;
let instance: S3Storage | undefined;

/** The configured storage, or null when S3_* env vars are missing. */
export function getStorage(): Storage | null {
  if (override !== undefined) return override;
  if (!isStorageConfigured()) return null;
  instance ??= new S3Storage();
  return instance;
}

/** Tests only: swap in an in-memory storage (or null to simulate "not configured"). Pass undefined to reset. */
export function setStorageForTests(storage: Storage | null | undefined) {
  override = storage;
}

/** Best-effort cleanup — a leftover object must not block deleting a row. */
export async function removeObjects(keys: string[]) {
  const storage = getStorage();
  if (!storage) return;
  await Promise.all(
    keys.map((key) =>
      storage.remove(key).catch((e) => {
        console.error(`Could not delete stored object ${key}:`, e);
      }),
    ),
  );
}
