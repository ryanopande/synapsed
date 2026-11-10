

import { Mistral } from '@mistralai/mistralai';

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });


export async function getOcrMarkdown(url: string): Promise<{ page: number; markdown: string }[]> {
  const ocrResponse = await client.ocr.process({
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      documentUrl: url,
    },
  });

  return ocrResponse.pages.map((page, index) => ({
    page: (page.index ?? index) + 1,
    markdown: page.markdown,
  }));
}
