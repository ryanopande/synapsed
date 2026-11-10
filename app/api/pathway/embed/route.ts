import { getOcrMarkdown } from '@/lib/ocr/getOcrMardown';
import { embedAndStore } from '@/lib/pinecone/embedAndStore';
import { chunkMarkdownByPage } from '@/lib/chunking/chunkMarkdown';
//This function was used to text the API endpoints and create the initial version of the Pathways. 
// given that now we uploaded content on the cloud and returned the link. this is not needed anymore but will be kept just in case. 
export async function POST(req: Request) {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
      const FileText = await file.text()
      const markdown = await getOcrMarkdown(FileText);
      const chunks = await chunkMarkdownByPage(markdown);
      await embedAndStore(chunks, "default");
  
      return Response.json({ status: 'success', chunks });
    } catch (err: unknown) {
      console.error('Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return Response.json({ error: errorMessage }, { status: 500 });
    }
  }
  
  
  
  //await embedAndStore(chunks, /* metadata */);

