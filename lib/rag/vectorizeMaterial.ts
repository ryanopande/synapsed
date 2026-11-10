import { prisma } from "@/lib/db/prisma";
import { ocrFromUrl } from "@/lib/ai/mistral";
import { chunkMarkdownByPage } from "./chunkMarkdown";
import { embedAndStore } from "./embedAndStore";

type Material = {
  id: string;
  url: string;
  title: string;
  type: string;
  mimeType: string;
  classId: string;
  vectorNamespace: string;
};

export async function vectorizeAndUpdate(material: Material) {
  try {
    // Step 1: Directly process URL with Mistral OCR
    const markdownPages = await ocrFromUrl(material.url);

    // Step 2: Chunk
    const chunks = await chunkMarkdownByPage(markdownPages);

    // Step 3: Embed & store with extra metadata
    await embedAndStore(chunks, material.vectorNamespace, {
      classId: material.classId,
      materialId: material.id,
      title: material.title,
    });

    // Step 4: Update Mongo
    await prisma.classMaterial.update({
      where: { id: material.id },
      data: {
        isVectorized: true,
      },
    });

    //console.log(`✅ Vectorization complete for ${material.title}`);
  } catch (err) {
    console.error(`❌ Vectorization failed for ${material.title}:`, err);
  }
} 