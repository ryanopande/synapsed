// Cloudflare R2 (S3-compatible) client shared by all upload helpers.
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/** Public URL of an object stored under `objectKey`. */
export function r2PublicUrl(objectKey: string): string {
  return `${process.env.R2_PUBLIC_URL}/${objectKey}`;
}
