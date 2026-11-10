import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

export async function queryPinecone(query: string, namespace = "shayans-namespace") {
  const model = "llama-text-embed-v2";

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
