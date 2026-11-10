import { EMBEDDING_MODEL, pinecone, pineconeIndex } from '@/lib/rag/pinecone';

const index = pineconeIndex;

export async function queryPinecone(query: string, namespace: string) {
  const model = EMBEDDING_MODEL;

  // Embed the query
  const embedding = await pinecone.inference.embed(
    model,
    [query],
    { inputType: "query", truncate: "END" }
  );

  const emb = embedding.data[0];

  if (emb.vectorType!=="dense"){
    throw new Error(`Expected dense embedding but got: ${emb.vectorType}`);
  }

  const queryVector = emb.values;

  const results = await index.namespace(namespace).query({
    topK: 5,
    vector: queryVector,
    includeMetadata: true,
    includeValues: false
  });

  return results.matches;
}
