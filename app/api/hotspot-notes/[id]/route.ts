import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/hotspot-notes/[id] - Get a specific hotspot note
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
    const note = await prisma.note.findFirst({
      where: {
        id: id,
        createdBy: session.user.id
      },
      include: {
        contentReference: {
          include: {
            document: true
          }
        }
      }
    })

    if (!note) {
      return NextResponse.json({ error: 'Hotspot note not found' }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error fetching hotspot note:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/hotspot-notes/[id] - Update a hotspot note
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
    const { content, tags, color } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const note = await prisma.note.updateMany({
      where: {
        id: id,
        createdBy: session.user.id
      },
      data: {
        content,
        ...(tags && { tags }),
        ...(color && { color }),
        lastModified: new Date()
      }
    })

    if (note.count === 0) {
      return NextResponse.json({ error: 'Hotspot note not found' }, { status: 404 })
    }

    const updatedNote = await prisma.note.findUnique({
      where: { id: id },
      include: {
        contentReference: {
          include: {
            document: true
          }
        }
      }
    })

    return NextResponse.json(updatedNote)
  } catch (error) {
    console.error('Error updating hotspot note:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/hotspot-notes/[id] - Delete a hotspot note
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
    const note = await prisma.note.deleteMany({
      where: {
        id: id,
        createdBy: session.user.id
      }
    })

    if (note.count === 0) {
      return NextResponse.json({ error: 'Hotspot note not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Hotspot note deleted successfully' })
  } catch (error) {
    console.error('Error deleting hotspot note:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
