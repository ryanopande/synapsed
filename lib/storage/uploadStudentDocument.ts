import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, r2PublicUrl } from "@/lib/storage/r2";
import crypto from "crypto";

export async function uploadStudentDocumentToR2(fileBuffer: Buffer, fileName: string, mimeType: string, studentId: string) {
  const uniqueSuffix = crypto.randomUUID();
  const objectKey = `synapsed/student_${studentId}/${uniqueSuffix}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await r2.send(command);

  return r2PublicUrl(objectKey);
}
