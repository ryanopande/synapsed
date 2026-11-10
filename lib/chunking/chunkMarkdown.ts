import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function chunkMarkdownByPage(
  pages: { page: number; markdown: string }[],
  chunkSize = 1000,
  chunkOverlap = 200
): Promise<{ text: string; metadata: { page: number; lines: { from: number; to: number } } }[]> {
  const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
    chunkSize,
    chunkOverlap
  });

  const allChunks: { text: string; metadata: { page: number; lines: { from: number; to: number } } }[] = [];

  for (const page of pages) {
    const docs = await splitter.createDocuments([page.markdown]);

    for (const doc of docs) {
      allChunks.push({
        text: doc.pageContent,
        metadata: {
          page: page.page,
          lines: doc.metadata?.loc?.lines || { from: 0, to: 0 }
        }
      });
    }
  }

  return allChunks;
}
