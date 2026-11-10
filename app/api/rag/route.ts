import { NextRequest, NextResponse } from 'next/server';
import { uploadToMistral } from '@/lib/rag/UploadToMistral';
import { getOcrMarkdown } from '@/lib/rag/ragGetMarkdown';
import { chunkMarkdownByPage } from '@/lib/chunking/chunkMarkdown';
import { embedAndStore } from '@/lib/pinecone/embedAndStore';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and images are supported.' },
        { status: 400 }
      );
    }

    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 20MB.' },
        { status: 400 }
      );
    }

    //console.log(`📤 Processing file: ${file.name} (${file.size} bytes)`);

    // Upload to Mistral for OCR processing
    const uploadRes = await uploadToMistral(file);
    const markdown = await getOcrMarkdown(uploadRes.id);
    const chunks = await chunkMarkdownByPage(markdown);

    //console.log(`✅ Successfully processed ${chunks.length} chunks`);

    // vectorize and store
    const dummyClassDetails = {
      classId: "test-class-123",
      materialId: `temp-${Date.now()}`,
      title: file.name
    };

    //console.log("Embedding and storing chunks...");

    await embedAndStore(chunks, 'shayans-namespace', dummyClassDetails);

    return NextResponse.json({
      success: true,
      chunks: chunks,
      totalChunks: chunks.length,
      fileName: file.name,
      fileSize: file.size,
      mistralFileId: uploadRes.id,
      vectorized: true,
      namespace: 'shayans-namespace',
      classDetails: dummyClassDetails
    });

  } catch (error) {
    console.error('❌ RAG processing failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'RAG API endpoint',
    supportedFormats: ['PDF', 'JPEG', 'PNG'],
    maxFileSize: '20MB'
  });
}
