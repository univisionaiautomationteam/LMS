import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "1 GB";
const TICKET_TTL_SECONDS = 900;

/** Keys are server-generated; this pattern is re-validated on every write. */
const SAFE_KEY = /^courses\/[a-z0-9-]{1,64}\/(video|document)\/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,80}$/;

const LOCAL_ROOT = path.resolve(process.env.LOCAL_UPLOAD_DIR || "uploads");

let cachedClient = null;

function s3Client() {
  if (!process.env.S3_BUCKET) return null;
  cachedClient ??= new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  return cachedClient;
}

/** "s3" when a bucket is configured, otherwise files land on the API's own disk. */
export function storageMode() {
  return process.env.S3_BUCKET ? "s3" : "local";
}

function apiBase() {
  const configured = process.env.PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT || 5000}`;
}

function buildObjectKey({ course, kind, filename }) {
  const safeName =
    String(filename ?? "")
      .replace(/[^A-Za-z0-9._-]/g, "-")
      .replace(/^[.-]+/, "")
      .slice(-80) || "file";
  return `courses/${course}/${kind}/${randomUUID()}-${safeName}`;
}

export function isSafeObjectKey(key) {
  return SAFE_KEY.test(String(key ?? ""));
}

function publicAssetUrl(key) {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
}

/**
 * Issues a short-lived ticket the browser uses to upload straight to storage.
 *
 * A presigned POST is used rather than a presigned PUT because S3 enforces the
 * `content-length-range` and `Content-Type` conditions server-side, so the 1 GB
 * cap and the mime allowlist cannot be bypassed by skipping this server.
 */
export async function createUploadTicket({ course, kind, mimeType, filename }) {
  const objectKey = buildObjectKey({ course, kind, filename });

  if (storageMode() === "s3") {
    const { url, fields } = await createPresignedPost(s3Client(), {
      Bucket: process.env.S3_BUCKET,
      Key: objectKey,
      Expires: TICKET_TTL_SECONDS,
      Conditions: [
        ["content-length-range", 0, MAX_UPLOAD_BYTES],
        ["eq", "$Content-Type", mimeType],
      ],
      Fields: { "Content-Type": mimeType },
    });
    return { mode: "s3", objectKey, uploadUrl: url, fields, assetUrl: publicAssetUrl(objectKey) };
  }

  return {
    mode: "local",
    objectKey,
    uploadUrl: `${apiBase()}/api/assets/raw/${objectKey}`,
    fields: {},
    assetUrl: `${apiBase()}/uploads/${objectKey}`,
  };
}

/** A time-limited URL for downloading. Private buckets get a presigned GET. */
export async function signDownloadUrl(objectKey) {
  if (!isSafeObjectKey(objectKey)) throw new Error("Invalid object key.");
  if (storageMode() === "s3" && !process.env.S3_PUBLIC_BASE_URL) {
    return getSignedUrl(
      s3Client(),
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: objectKey }),
      { expiresIn: TICKET_TTL_SECONDS }
    );
  }
  if (storageMode() === "s3") return publicAssetUrl(objectKey);
  return `${apiBase()}/uploads/${objectKey}`;
}

export async function writeLocalObject(objectKey, body) {
  if (!isSafeObjectKey(objectKey)) throw new Error("Invalid object key.");
  const target = path.resolve(LOCAL_ROOT, objectKey);
  if (!target.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid object key.");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
  return target;
}

export function localUploadRoot() {
  return LOCAL_ROOT;
}
