import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

// GET: Fetch aggregate statistics for a class
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = await params;

    // Verify professor owns this class
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { professorId: true, title: true },
    });

    if (!classRecord || classRecord.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all enrolled students
    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId },
    });

    // Get all pathways for this class to get nodes
    const pathways = await prisma.learningPathway.findMany({
      where: { classId },
      include: {
        nodes: {
          select: {
            id: true,
          },
        },
      },
    });

    // Get all assessment responses
    const nodeIds = pathways.flatMap((p) => p.nodes.map((n) => n.id));
    const responses = await prisma.inChatAssessmentResponse.findMany({
      where: {
        assessment: {
          nodeId: { in: nodeIds },
        },
      },
      select: {
        score: true,
      },
    });

    const scores = responses
      .map((r) => r.score)
      .filter((s): s is number => s !== null);

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null;

    return NextResponse.json({
      classId,
      className: classRecord.title,
      totalStudents: enrollments.length,
      totalAssessments: responses.length,
      averageScore,
    });
  } catch (error) {
    console.error('Error fetching aggregate statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aggregate statistics' },
      { status: 500 }
    );
  }
}

