import { Mistral } from '@mistralai/mistralai';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export async function getOcrMarkdown(fileId: string): Promise< { page: number; markdown: string }[]> {
  const signedUrl = await client.files.getSignedUrl({ fileId });

  const ocrResponse = await client.ocr.process({
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      documentUrl: signedUrl.url,
    },
  });

  return ocrResponse.pages.map((page, index) => ({
    page: (page.index ?? index) + 1,
    markdown: page.markdown,
  }));
}