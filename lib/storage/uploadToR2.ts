import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, r2PublicUrl } from "@/lib/storage/r2";
import crypto from "crypto";

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

  return r2PublicUrl(objectKey);
}
