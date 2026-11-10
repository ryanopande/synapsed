//import { prisma } from "@/lib/prisma";
import { getOcrMarkdown } from "./ragGetMarkdown";
import { chunkMarkdownByPage } from "@/lib/chunking/chunkMarkdown";
import { embedAndStore } from "@/lib/pinecone/embedAndStore";
import { uploadToMistral } from "./UploadToMistral";

type Material = {
  id: string;
  url: string;
  title: string;
  type: string;
  mimeType: string;
  classId: string;
  vectorNamespace: string;
};

export async function vectorizeAndUpdate(material: Material, file: File) {
  try {
    // Upload to Mistral for OCR processing
    const uploadRes = await uploadToMistral(file);
    const markdown = await getOcrMarkdown(uploadRes.id);
    const chunks = await chunkMarkdownByPage(markdown);
    
    // Step 3: Embed & store with extra metadata
    await embedAndStore(chunks, material.vectorNamespace, {
      classId: material.classId,
      materialId: material.id,
      title: material.title,
    });

    // // Step 4: Update Mongo
    // await prisma.classMaterial.update({
    //   where: { id: material.id },
    //   data: {
    //     isVectorized: true,
    //   },
    // });

    console.log(`✅ Vectorization complete for ${material.title}`);
  } catch (err) {
    console.error(`❌ Vectorization failed for ${material.title}:`, err);
  }
} 