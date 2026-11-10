

import { Pinecone } from '@pinecone-database/pinecone';

type Chunk = {
  text: string;
  metadata: {
    page: number;
    lines: { from: number; to: number };
  };
};

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

type ExtraMetadata = {
  classId: string;
  materialId: string;
  title: string;
};

export async function embedAndStore(
  chunks: Chunk[],
  namespace = 'default',
  extraMetadata: ExtraMetadata = { classId: "", materialId: "", title: "" }
) {
  const data = chunks.map((chunk, i) => ({
    id: `chunk-${i}-${Date.now()}`, // Unique IDs
    text: chunk.text,
    metadata: chunk.metadata,
  }));

  const model = 'llama-text-embed-v2';
  const BATCH_SIZE = 90; // Pinecone limit is 96, using 90 to be safe

  console.time("Embeddings");
  
  // Process embeddings in batches
  const allVectors = [];
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const batchTexts = batch.map(d => d.text);
    
    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.length / BATCH_SIZE)} (${batch.length} chunks)`);
    
    const embeddings = await pinecone.inference.embed(
      model,
      batchTexts,
      { inputType: 'passage', truncate: 'END' }
    );

    const batchVectors = batch.map((d, j) => {
      const emb = embeddings.data[j];

      if (emb.vectorType !== "dense") {
        throw new Error(`Expected dense embedding but got: ${emb.vectorType}`);
      }

      return {
        id: d.id,
        values: emb.values,
        metadata: {
          text: d.text,
          page: d.metadata.page,
          lineStart: d.metadata.lines.from,
          lineEnd: d.metadata.lines.to,
          ...extraMetadata, // ⬅️ Merge global metadata here
        }
      };
    });

    allVectors.push(...batchVectors);
  }
  
  console.timeEnd("Embeddings");

  console.time("Upsert");
  // Pinecone upsert also has a limit (typically 100 vectors per request)
  const UPSERT_BATCH_SIZE = 100;
  for (let i = 0; i < allVectors.length; i += UPSERT_BATCH_SIZE) {
    const upsertBatch = allVectors.slice(i, i + UPSERT_BATCH_SIZE);
    await index.namespace(namespace).upsert(upsertBatch);
    console.log(`Upserted batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}/${Math.ceil(allVectors.length / UPSERT_BATCH_SIZE)} (${upsertBatch.length} vectors)`);
  }
  console.timeEnd("Upsert");

   await index.namespace(namespace).fetch(allVectors.slice(0, 5).map(v => v.id));
  //console.log("🧐 Fetched back:", verify);
}
