import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET: Fetch quiz notifications (quizzes student hasn't started)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || session.user.id;

    // Get all classes student is enrolled in
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        studentId,
      },
      include: {
        class: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const classIds = enrollments.map(e => e.classId);

    if (classIds.length === 0) {
      return NextResponse.json({ notifications: [] }, { status: 200 });
    }

    // Get all published quizzes in these classes
    const quizzes = await prisma.professorQuiz.findMany({
      where: {
        classId: { in: classIds },
        status: 'PUBLISHED',
      },
      include: {
        class: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            questions: true,
          },
        },
        responses: {
          where: {
            studentId,
          },
          select: {
            id: true,
            submittedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter to only quizzes student hasn't started
    const notifications = quizzes
      .filter(quiz => {
        const response = quiz.responses[0];
        return !response || !response.submittedAt; // Not started or not completed
      })
      .slice(0, 10) // Limit to 10 most recent
      .map(quiz => ({
        id: quiz.id,
        title: quiz.title,
        classId: quiz.classId,
        className: quiz.class.title,
        totalQuestions: quiz._count.questions,
      }));

    return NextResponse.json({ notifications }, { status: 200 });
  } catch (error) {
    console.error('Error fetching quiz notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

