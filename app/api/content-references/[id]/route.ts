import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma'

// GET /api/content-references/[id] - Get a specific content reference
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const contentReference = await prisma.contentReference.findFirst({
      where: {
        id: id,
        document: {
          uploadedBy: session.user.id
        }
      },
      include: {
        notes: {
          orderBy: {
            timestamp: 'desc'
          }
        },
        document: true
      }
    })

    if (!contentReference) {
      return NextResponse.json({ error: 'Content reference not found' }, { status: 404 })
    }

    return NextResponse.json(contentReference)
  } catch (error) {
    console.error('Error fetching content reference:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/content-references/[id] - Update a content reference
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contentPreview, coordinates } = body

    const { id } = await params
    const contentReference = await prisma.contentReference.updateMany({
      where: {
        id: id,
        document: {
          uploadedBy: session.user.id
        }
      },
      data: {
        ...(contentPreview && { contentPreview }),
        ...(coordinates && { coordinates })
      }
    })

    if (contentReference.count === 0) {
      return NextResponse.json({ error: 'Content reference not found' }, { status: 404 })
    }

    const updatedContentReference = await prisma.contentReference.findUnique({
      where: { id: id },
      include: {
        notes: true,
        document: true
      }
    })

    return NextResponse.json(updatedContentReference)
  } catch (error) {
    console.error('Error updating content reference:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/content-references/[id] - Delete a content reference
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // Get the content reference first to get the document ID
    const contentRef = await prisma.contentReference.findFirst({
      where: {
        id: id,
        document: {
          uploadedBy: session.user.id
        }
      },
      select: { documentId: true }
    })

    if (!contentRef) {
      return NextResponse.json({ error: 'Content reference not found' }, { status: 404 })
    }

    // Delete the content reference (this will cascade delete all notes)
    await prisma.contentReference.delete({
      where: { id: id }
    })

    // Update document annotation metadata
    await updateDocumentAnnotationMetadata(contentRef.documentId)

    return NextResponse.json({ message: 'Content reference deleted successfully' })
  } catch (error) {
    console.error('Error deleting content reference:', error)
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
