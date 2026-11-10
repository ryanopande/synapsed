import { NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2/uploadtoR2";
import { prisma } from "@/lib/prisma";
import { vectorizeAndUpdate } from "@/lib/vectorization";


function bufferFromFile(file: File): Promise<Buffer> {
  return new Response(file.stream()).arrayBuffer().then(buf => Buffer.from(buf));
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const classId = formData.get("classId") as string;
  const category = formData.get("category") as string || "CONTENT";
  const files = formData.getAll("files") as File[];

  if (!classId || files.length === 0) {
    return NextResponse.json({ error: "Missing classId or files" }, { status: 400 });
  }

  const results = [];

  // Process all files
  for (const file of files) {
    try {
      const buffer = await bufferFromFile(file);
      const fileUrl = await uploadToR2(buffer, file.name, file.type, classId, category.toLowerCase());

      const extension = file.name.split(".").pop()?.toLowerCase();
      const type =
        extension === "pdf" ? "PDF" :
        extension === "docx" ? "DOCX" :
        extension === "mp4" ? "MP4" :
        undefined;

      if (!type) {
        console.warn(`⚠️ Skipping unsupported file type: ${file.name}`);
        continue; // Skip files with unsupported types
      }

      const mimeType =
        extension === "pdf"
          ? "application/pdf"
          : extension === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : extension === "mp4"
          ? "video/mp4"
          : "application/octet-stream"; // fallback

      if (!type || !mimeType) {
        console.error(`❌ Skipping file "${file.name}" due to unsupported extension or missing MIME type`);
        continue; // Skip unsupported files
      }

      const material = await prisma.classMaterial.create({
        data: {
          classId,
          title: file.name,
          url: fileUrl,
          type: type,
          mimeType: mimeType,
          category: category as "CONTENT" | "SYLLABUS" | "EXERCISES",
          uploadedAt: new Date(),
          isVectorized: false,
          vectorNamespace: `class_${classId}`,
        },
      });

      results.push(material);

      // Only vectorize content category materials - run in background (fire and forget)
      if (category === "CONTENT") {
        // Don't await - let it run in background to avoid blocking the response
        vectorizeAndUpdate({
          ...material,
          vectorNamespace: material.vectorNamespace ?? "",
          mimeType: material.mimeType ?? ""
        }).catch(err => {
          console.error(`❌ Background vectorization failed for ${material.title}:`, err);
        });
      }

      // Auto-process syllabus files for pathway generation - also in background
      if (category === "SYLLABUS" && (type === "PDF" || type === "DOCX")) {
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/syllabus/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materialId: material.id }),
        }).catch(error => {
          console.error(`Failed to auto-process syllabus for ${material.title}:`, error);
        });
      }
    } catch (error) {
      console.error(`❌ Failed to process file "${file.name}":`, error);
      // Continue processing other files even if one fails
    }
  }

  // Return immediately after uploads complete, don't wait for vectorization
  // Vectorization will happen in the background
  return NextResponse.json({ 
    success: true, 
    materials: results,
    message: `${results.length} file(s) uploaded successfully. Vectorization is processing in the background.`
  });
}
