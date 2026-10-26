import "server-only";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma, type Tx } from "@sa/db";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../env";

let client: S3Client | undefined;
let bucketReady: Promise<void> | undefined;

function s3(): S3Client {
  if (client) return client;
  const e = env();
  client = new S3Client({
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY },
  });
  return client;
}

/** Legt den (privaten) Bucket beim ersten Zugriff an. */
export function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const Bucket = env().S3_BUCKET;
    try {
      await s3().send(new HeadBucketCommand({ Bucket }));
    } catch {
      await s3().send(new CreateBucketCommand({ Bucket }));
    }
  })().catch((err) => {
    bucketReady = undefined;
    throw err;
  });
  return bucketReady;
}

export interface StoreFileInput {
  data: Buffer;
  mimeType: string;
  originalName?: string;
  purpose: string;
  uploadedById?: string | null;
}

/** Speichert eine Datei in MinIO und legt den FileObject-Datensatz an. */
export async function storeFile(input: StoreFileInput, tx?: Tx) {
  await ensureBucket();
  const Bucket = env().S3_BUCKET;
  const ext = input.originalName?.match(/\.[a-z0-9]{1,6}$/i)?.[0]?.toLowerCase() ?? "";
  const key = `${input.purpose}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}${ext}`;
  await s3().send(
    new PutObjectCommand({ Bucket, Key: key, Body: input.data, ContentType: input.mimeType }),
  );
  return (tx ?? prisma).fileObject.create({
    data: {
      bucket: Bucket,
      key,
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
      sha256: createHash("sha256").update(input.data).digest("hex"),
      originalName: input.originalName?.slice(0, 200),
      purpose: input.purpose,
      uploadedById: input.uploadedById ?? null,
    },
  });
}

export async function readFile(bucket: string, key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("empty object");
  return { stream: res.Body.transformToWebStream(), contentType: res.ContentType };
}

/** Erkennt den Dateityp anhand der Magic Bytes (Client-Angaben werden nicht vertraut). */
export function sniffMimeType(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
