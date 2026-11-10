import { NextRequest, NextResponse } from 'next/server'
import { auth } from "@/auth";
import { prisma } from '@/lib/prisma'

// GET /api/documents/[id] - Get a specific document
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
    const document = await prisma.document.findFirst({
      where: {
        id: id,
        uploadedBy: session.user.id
      },
      include: {
        annotations: true,
        contentReferences: {
          include: {
            notes: true
          },
          orderBy: {
            pageNumber: 'asc'
          }
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error fetching document:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/documents/[id] - Update a document
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, folder, classId } = body

    const document = await prisma.document.updateMany({
      where: {
        id: id,
        uploadedBy: session.user.id
      },
      data: {
        ...(name && { name }),
        ...(folder !== undefined && { folder }),
        ...(classId !== undefined && { classId })
      }
    })

    if (document.count === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const updatedDocument = await prisma.document.findUnique({
      where: { id: id },
      include: {
        annotations: true
      }
    })

    return NextResponse.json(updatedDocument)
  } catch (error) {
    console.error('Error updating document:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/documents/[id] - Delete a document
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
    const document = await prisma.document.deleteMany({
      where: {
        id: id,
        uploadedBy: session.user.id
      }
    })

    if (document.count === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Error deleting document:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
