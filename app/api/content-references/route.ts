import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/content-references - Get content references for a document
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // Verify user has access to the document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        uploadedBy: session.user.id
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const contentReferences = await prisma.contentReference.findMany({
      where: {
        documentId
      },
      include: {
        notes: {
          orderBy: {
            timestamp: 'desc'
          }
        }
      },
      orderBy: {
        pageNumber: 'asc'
      }
    })

    return NextResponse.json(contentReferences)
  } catch (error) {
    console.error('Error fetching content references:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/content-references - Create a new content reference
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { documentId, pageNumber, contentType, contentHash, contentPreview, coordinates } = body

    if (!documentId || !pageNumber || !contentType || !contentHash || !contentPreview || !coordinates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to the document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        uploadedBy: session.user.id
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const contentReference = await prisma.contentReference.create({
      data: {
        documentId,
        pageNumber,
        contentType: contentType.toUpperCase(),
        contentHash,
        contentPreview,
        coordinates
      },
      include: {
        notes: true
      }
    })

    // Update document annotation metadata
    await updateDocumentAnnotationMetadata(documentId)

    return NextResponse.json(contentReference, { status: 201 })
  } catch (error) {
    console.error('Error creating content reference:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to update document annotation metadata
async function updateDocumentAnnotationMetadata(documentId: string) {
  try {
    const contentReferences = await prisma.contentReference.findMany({
      where: { documentId },
      select: { pageNumber: true }
    })

    const pagesWithNotes = [...new Set(contentReferences.map(ref => ref.pageNumber))].sort((a, b) => a - b)

    await prisma.documentAnnotation.upsert({
      where: { documentId },
      update: {
        pagesWithNotes,
        lastModified: new Date()
      },
      create: {
        documentId,
        pagesWithNotes,
        totalNotes: 0
      }
    })
  } catch (error) {
    console.error('Error updating document annotation metadata:', error)
  }
}
