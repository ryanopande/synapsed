import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadQuizImageToR2(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  classId: string,
  quizId: string
): Promise<string> {
  // Validate required environment variables
  if (!process.env.R2_ENDPOINT) {
    throw new Error('R2_ENDPOINT environment variable is not set');
  }
  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error('R2_ACCESS_KEY_ID environment variable is not set');
  }
  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_SECRET_ACCESS_KEY environment variable is not set');
  }
  if (!process.env.R2_BUCKET_NAME) {
    throw new Error('R2_BUCKET_NAME environment variable is not set');
  }
  if (!process.env.R2_PUBLIC_URL) {
    throw new Error('R2_PUBLIC_URL environment variable is not set');
  }

  const uniqueSuffix = crypto.randomUUID();
  // Sanitize fileName to prevent path traversal issues
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `synapsed/class_${classId}/quizzes/${quizId}/images/${uniqueSuffix}-${sanitizedFileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  try {
    await r2.send(command);
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error(`Failed to upload image to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return `${process.env.R2_PUBLIC_URL}/${objectKey}`;
}

