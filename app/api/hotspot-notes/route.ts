import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma'

// GET /api/hotspot-notes - Get hotspot notes for a content reference
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contentReferenceId = searchParams.get('contentReferenceId')

    if (!contentReferenceId) {
      return NextResponse.json({ error: 'Content reference ID is required' }, { status: 400 })
    }

    // Verify user has access to the content reference
    const contentReference = await prisma.contentReference.findFirst({
      where: {
        id: contentReferenceId,
        document: {
          uploadedBy: session.user.id
        }
      }
    })

    if (!contentReference) {
      return NextResponse.json({ error: 'Content reference not found' }, { status: 404 })
    }

    const notes = await prisma.note.findMany({
      where: {
        contentReferenceId
      },
      orderBy: {
        timestamp: 'desc'
      }
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/hotspot-notes - Create a new hotspot note
export async function POST(request: NextRequest) {
  try {
    const session = await auth()  
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contentReferenceId, content, tags, color } = body

    if (!contentReferenceId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to the content reference
    const contentReference = await prisma.contentReference.findFirst({
      where: {
        id: contentReferenceId,
        document: {
          uploadedBy: session.user.id
        }
      }
    })

    if (!contentReference) {
      return NextResponse.json({ error: 'Content reference not found' }, { status: 404 })
    }

    const note = await prisma.note.create({
      data: {
        contentReferenceId,
        content,
        tags: tags || [],
        color,
        createdBy: session.user.id
      }
    })

    // Update document annotation metadata
    await updateDocumentAnnotationMetadata(contentReference.documentId)

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to update document annotation metadata
async function updateDocumentAnnotationMetadata(documentId: string) {
  try {
    const totalNotes = await prisma.note.count({
      where: {
        contentReference: {
          documentId
        }
      }
    })

    const contentReferences = await prisma.contentReference.findMany({
      where: { documentId },
      select: { pageNumber: true }
    })

    const pagesWithNotes = [...new Set(contentReferences.map(ref => ref.pageNumber))].sort((a, b) => a - b)

    await prisma.documentAnnotation.upsert({
      where: { documentId },
      update: {
        totalNotes,
        pagesWithNotes,
        lastModified: new Date()
      },
      create: {
        documentId,
        totalNotes,
        pagesWithNotes
      }
    })
  } catch (error) {
    console.error('Error updating document annotation metadata:', error)
  }
}
