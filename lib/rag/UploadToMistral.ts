import { Mistral } from '@mistralai/mistralai';


const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export async function uploadToMistral(file: File): Promise<{ id: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploaded = await client.files.upload({
    file: {
      fileName: file.name,
      content: buffer,
    },
    purpose: 'ocr',
  });
  // returning the id so we can use it to get OCR
  return uploaded;
}