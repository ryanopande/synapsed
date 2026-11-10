import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

// GET: Fetch all assessment data for a class
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
      select: { professorId: true },
    });

    if (!classRecord || classRecord.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all enrolled students
    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get all pathways for this class to get nodes
    const pathways = await prisma.learningPathway.findMany({
      where: { classId },
      include: {
        nodes: {
          select: {
            id: true,
            nodeId: true,
            title: true,
            description: true,
          },
        },
      },
    });

    // Get all in-chat assessments for this class (through nodes)
    const nodeIds = pathways.flatMap((p) => p.nodes.map((n) => n.id));
    const assessments = await prisma.inChatAssessment.findMany({
      where: {
        nodeId: { in: nodeIds },
      },
      include: {
        node: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        responses: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Organize data by student
    const studentData = enrollments.map((enrollment) => {
      const student = enrollment.student;
      
      // Get all responses for this student
      const studentResponses = assessments.flatMap((assessment) =>
        assessment.responses
          .filter((response) => response.studentId === student.id)
          .map((response) => ({
            assessmentId: assessment.id,
            topic: assessment.topic,
            nodeId: assessment.nodeId,
            nodeTitle: assessment.node?.title || assessment.nodeTitle || 'Unknown Node',
            nodeDescription: assessment.node?.description || '',
            submittedAt: response.submittedAt,
            score: response.score,
            feedback: response.feedback,
            responses: response.responses, // This contains question labels as keys
            fields: assessment.fields, // Assessment questions structure
            correctAnswers: assessment.correctAnswers,
          }))
      );

      // Calculate aggregate score
      const scores = studentResponses
        .map((r) => r.score)
        .filter((s): s is number => s !== null);
      const aggregateScore =
        scores.length > 0
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length
          : null;

      // Group responses by node
      const nodeMap = new Map<string, typeof studentResponses>();
      studentResponses.forEach((response) => {
        const nodeId = response.nodeId || 'unknown';
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, []);
        }
        nodeMap.get(nodeId)!.push(response);
      });

      const nodes = Array.from(nodeMap.entries()).map(([nodeId, responses]) => {
        const firstResponse = responses[0];
        return {
          nodeId,
          nodeTitle: firstResponse.nodeTitle,
          nodeDescription: firstResponse.nodeDescription,
          assessments: responses.map((r) => ({
            assessmentId: r.assessmentId,
            topic: r.topic,
            submittedAt: r.submittedAt,
            score: r.score,
            feedback: r.feedback,
            responses: r.responses,
            fields: r.fields,
            correctAnswers: r.correctAnswers,
          })),
        };
      });

      // Generate performance notes (simplified version)
      const performanceNotes = generatePerformanceNotes(
        aggregateScore,
        scores,
        nodes
      );

      return {
        studentId: student.id,
        studentName: student.name || 'Unknown Student',
        studentEmail: student.email,
        aggregateScore,
        assessmentCount: studentResponses.length,
        performanceNotes,
        nodes,
      };
    });

    return NextResponse.json({
      classId,
      students: studentData,
      totalStudents: enrollments.length,
      totalAssessments: assessments.reduce(
        (sum, a) => sum + a.responses.length,
        0
      ),
    });
  } catch (error) {
    console.error('Error fetching assessment data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assessment data' },
      { status: 500 }
    );
  }
}

// Helper function to generate performance notes
function generatePerformanceNotes(
  aggregateScore: number | null,
  scores: number[],
  nodes: Array<{ nodeTitle: string; assessments: Array<{ score: number | null }> }>
): string {
  if (!aggregateScore || scores.length === 0) {
    return 'No assessments completed yet.';
  }

  const notes: string[] = [];

  // Overall performance
  if (aggregateScore >= 85) {
    notes.push('Excellent overall performance');
  } else if (aggregateScore >= 70) {
    notes.push('Good overall performance');
  } else {
    notes.push('Performance needs improvement');
  }

  // Find strongest and weakest nodes
  const nodeAverages = nodes.map((node) => {
    const nodeScores = node.assessments
      .map((a) => a.score)
      .filter((s): s is number => s !== null);
    const avg =
      nodeScores.length > 0
        ? nodeScores.reduce((sum, s) => sum + s, 0) / nodeScores.length
        : null;
    return { nodeTitle: node.nodeTitle, average: avg };
  });

  const validAverages = nodeAverages.filter((n) => n.average !== null);
  if (validAverages.length > 0) {
    const strongest = validAverages.reduce((max, n) =>
      (n.average || 0) > (max.average || 0) ? n : max
    );
    const weakest = validAverages.reduce((min, n) =>
      (n.average || 0) < (min.average || 0) ? n : min
    );

    if (strongest.average && strongest.average >= 80) {
      notes.push(`Strongest in ${strongest.nodeTitle}`);
    }
    if (weakest.average && weakest.average < 70 && weakest.nodeTitle !== strongest.nodeTitle) {
      notes.push(`Consider reviewing ${weakest.nodeTitle}`);
    }
  }

  return notes.join('. ') + '.';
}

