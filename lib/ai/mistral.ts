// Mistral client and OCR helpers (PDF/image -> markdown per page).
import { Mistral } from "@mistralai/mistralai";

export const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

/** Shared Mistral client. */
export const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export type OcrPage = { page: number; markdown: string };

/** OCRs a document reachable at a public URL. */
export async function ocrFromUrl(documentUrl: string): Promise<OcrPage[]> {
  const ocrResponse = await mistral.ocr.process({
    model: MISTRAL_OCR_MODEL,
    document: { type: "document_url", documentUrl },
  });

  return ocrResponse.pages.map((page, index) => ({
    page: (page.index ?? index) + 1,
    markdown: page.markdown,
  }));
}

/** Uploads a file to Mistral and OCRs it (for files that are not publicly hosted). */
export async function ocrFromFile(file: File): Promise<OcrPage[]> {
  const uploaded = await mistral.files.upload({
    file: { fileName: file.name, content: Buffer.from(await file.arrayBuffer()) },
    purpose: "ocr",
  });
  const signedUrl = await mistral.files.getSignedUrl({ fileId: uploaded.id });
  return ocrFromUrl(signedUrl.url);
}
