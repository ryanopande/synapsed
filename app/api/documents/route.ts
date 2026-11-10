import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadStudentDocumentToR2 } from '@/lib/r2/studentDoctoR2'
import { DocumentType } from '@prisma/client'

// GET /api/documents - Get all documents for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder')
    const classId = searchParams.get('classId')

    const where: {
      uploadedBy: string
      folder?: string
      classId?: string
    } = {
      uploadedBy: session.user.id
    }

    if (folder) {
      where.folder = folder
    }

    if (classId) {
      where.classId = classId
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        annotations: true,
        _count: {
          select: {
            contentReferences: true
          }
        }
      },
      orderBy: {
        lastModified: 'desc'
      }
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error('Error fetching documents:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/documents - Create a new document
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string
    const classId = formData.get('classId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to R2
    const fileUrl = await uploadStudentDocumentToR2(
      buffer,
      file.name,
      file.type,
      session.user.id
    )

    // Create document in database
    const document = await prisma.document.create({
      data: {
        name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        type: (file.name.split('.').pop()?.toUpperCase() as DocumentType) || DocumentType.PDF,
        url: fileUrl,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        folder: folder || 'recent',
        classId: classId || null,
        uploadedBy: session.user.id,
        mimeType: file.type,
        originalName: file.name
      },
      include: {
        annotations: true
      }
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
