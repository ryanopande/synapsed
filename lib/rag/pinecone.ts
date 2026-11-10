// Pinecone client and the index that stores class material embeddings.
import { Pinecone } from "@pinecone-database/pinecone";

export const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
export const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME!);

/** Embedding model used for both stored chunks and queries. */
export const EMBEDDING_MODEL = "llama-text-embed-v2";
