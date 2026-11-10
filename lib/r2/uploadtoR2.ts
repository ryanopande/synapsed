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

export async function uploadToR2(fileBuffer: Buffer, fileName: string, mimeType: string, classId: string, category: string = 'content') {
  const uniqueSuffix = crypto.randomUUID();
  const objectKey = `synapsed/class_${classId}/${category}/${uniqueSuffix}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await r2.send(command);

  return `${process.env.R2_PUBLIC_URL}/${objectKey}`;
}
