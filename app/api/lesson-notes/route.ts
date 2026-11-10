import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';
import { auth } from '@/auth';

type PrismaWithLessonNote = PrismaClient & {
  lessonNote: {
    findFirst: (...args: unknown[]) => Promise<unknown>;
    create: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
    upsert: (...args: unknown[]) => Promise<unknown>;
  };
};

const prismaLN = prisma as unknown as PrismaWithLessonNote;

type NodeRecord = { id: string; title: string; nodeId?: string };

// Resolve the student's pathway node (DB id) from (studentId, classId, nodeKey)
async function resolvePathwayNode(studentId: string, classId: string, nodeKey: string): Promise<NodeRecord | null> {
  const pathway = await prisma.learningPathway.findFirst({
    where: { studentId, classId },
    select: { id: true },
  });
  if (!pathway) return null;
  const node = await prisma.pathwayNode.findFirst({
    where: { pathwayId: pathway.id, nodeId: nodeKey },
    select: { id: true, title: true, nodeId: true },
  });
  return node as NodeRecord | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId') || '';
    const nodeKey = searchParams.get('nodeId') || '';
    const dbNodeId = searchParams.get('dbNodeId') || '';

    if (!classId || (!nodeKey && !dbNodeId)) {
      return NextResponse.json({ error: 'classId and one of (nodeId, dbNodeId) are required' }, { status: 400 });
    }

    const studentId = session.user.id;
    let node: NodeRecord | null = null;
    if (dbNodeId) {
      const found = await prisma.pathwayNode.findFirst({ where: { id: dbNodeId }, select: { id: true, title: true, nodeId: true } });
      node = found as NodeRecord | null;
    } else {
      node = await resolvePathwayNode(studentId, classId, nodeKey);
    }
    if (!node) {
      return NextResponse.json({ error: 'Pathway node not found' }, { status: 404 });
    }

    const existing = await prismaLN.lessonNote.findFirst({
      where: { studentId, classId, pathwayNodeId: node.id },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    // Create empty note lazily
    const created = await prismaLN.lessonNote.create({
      data: {
        studentId,
        classId,
        pathwayNodeId: node.id,
        nodeKey: nodeKey || node.nodeId || '',
        title: node.title,
        content: [],
        aiEntries: [],
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('[GET_LESSON_NOTE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { classId, nodeId: nodeKey, dbNodeId, content, title } = body as {
      classId: string;
      nodeId?: string;
      dbNodeId?: string;
      content: unknown;
      title?: string;
    };

    if (!classId || (!nodeKey && !dbNodeId) || content === undefined) {
      return NextResponse.json({ error: 'classId and one of (nodeId, dbNodeId) and content are required' }, { status: 400 });
    }

    const studentId = session.user.id;
    let node: NodeRecord | null = null;
    if (dbNodeId) {
      const found = await prisma.pathwayNode.findFirst({ where: { id: dbNodeId }, select: { id: true, title: true, nodeId: true } });
      node = found as NodeRecord | null;
    } else if (nodeKey) {
      node = await resolvePathwayNode(studentId, classId, nodeKey);
    }
    if (!node) {
      return NextResponse.json({ error: 'Pathway node not found' }, { status: 404 });
    }

    // Simple text extraction for search/word count
    let contentText: string | undefined = undefined;
    let wordCount: number | undefined = undefined;
    try {
      const str = JSON.stringify(content);
      contentText = str.replace(/\s+/g, ' ').slice(0, 10000);
      wordCount = contentText.trim() ? contentText.trim().split(/\s+/).length : 0;
    } catch {
      // ignore text extraction errors
    }

    const existingForUpsert = (await prismaLN.lessonNote.findFirst({
      where: { studentId, classId, pathwayNodeId: node.id },
      select: { id: true },
    })) as { id: string } | null;

    const updated = await prismaLN.lessonNote.upsert({
      where: {
        // Prisma requires unique input; use existing id or a dummy that will trigger create
        id: existingForUpsert?.id || '__missing__',
      },
      update: {
        content,
        ...(title ? { title } : {}),
        contentText,
        wordCount,
      },
      create: {
        studentId,
        classId,
        pathwayNodeId: node.id,
        nodeKey: nodeKey || node.nodeId || '',
        title: title ?? node.title,
        content,
        contentText,
        wordCount,
        aiEntries: [],
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH_LESSON_NOTE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { classId, nodeId: nodeKey, dbNodeId, action, selectedText, outputBlocks, outputMarkdown } = body as {
      classId: string;
      nodeId?: string;
      dbNodeId?: string;
      action: string;
      selectedText?: string;
      outputBlocks: unknown;
      outputMarkdown?: string;
    };

    if (!classId || (!nodeKey && !dbNodeId) || !action || outputBlocks === undefined) {
      return NextResponse.json({ error: 'classId and one of (nodeId, dbNodeId), action, outputBlocks are required' }, { status: 400 });
    }

    const studentId = session.user.id;
    let node: NodeRecord | null = null;
    if (dbNodeId) {
      const found = await prisma.pathwayNode.findFirst({ where: { id: dbNodeId }, select: { id: true, title: true, nodeId: true } });
      node = found as NodeRecord | null;
    } else if (nodeKey) {
      node = await resolvePathwayNode(studentId, classId, nodeKey);
    }
    if (!node) {
      return NextResponse.json({ error: 'Pathway node not found' }, { status: 404 });
    }

    const existing = (await prismaLN.lessonNote.findFirst({
      where: { studentId, classId, pathwayNodeId: node.id },
      select: { id: true },
    })) as { id: string } | null;

    const updated = existing
      ? await prismaLN.lessonNote.update({
          where: { id: existing.id },
          data: {
            aiEntries: {
              push: {
                id: Math.random().toString(36).slice(2),
                action,
                selectedText,
                outputBlocks,
                outputMarkdown,
                createdAt: new Date().toISOString(),
              },
            },
          },
        })
      : await prismaLN.lessonNote.create({
          data: {
            studentId,
            classId,
            pathwayNodeId: node.id,
            nodeKey: nodeKey || node.nodeId || '',
            title: undefined,
            content: [],
            aiEntries: [
              {
                id: Math.random().toString(36).slice(2),
                action,
                selectedText,
                outputBlocks,
                outputMarkdown,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[POST_LESSON_NOTE_AI_ENTRY]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

