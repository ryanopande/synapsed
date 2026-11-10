import { queryPinecone } from "@/lib/pinecone/queryPinecone";

// this is for querying content from the vector db. 
export async function POST(req: Request) {
  const { query } = await req.json();
  const matches = await queryPinecone(query);
  return Response.json({ matches });
}
