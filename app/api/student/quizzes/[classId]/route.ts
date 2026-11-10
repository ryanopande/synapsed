import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET: Fetch all published quizzes for a class that the student is enrolled in
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || session.user.id;

    // Verify student is enrolled in this class
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        classId,
        studentId,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this class' }, { status: 403 });
    }

    // Fetch published quizzes for this class
    const quizzes = await prisma.professorQuiz.findMany({
      where: {
        classId,
        status: 'PUBLISHED',
      },
      include: {
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
            score: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform quizzes to include student status
    const formattedQuizzes = quizzes.map((quiz) => {
      const response = quiz.responses[0];
      let status: "not-started" | "in-progress" | "completed" = "not-started";
      
      if (response) {
        status = response.submittedAt ? "completed" : "in-progress";
      }

      // Check if quiz is overdue
      const isOverdue = quiz.dueDate 
        ? new Date(quiz.dueDate) < new Date() && status !== "completed"
        : false;

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        totalQuestions: quiz._count.questions,
        status,
        score: response?.score,
        submittedAt: response?.submittedAt,
        dueDate: quiz.dueDate || undefined,
        isOverdue,
      };
    });

    return NextResponse.json({ quizzes: formattedQuizzes }, { status: 200 });
  } catch (error) {
    console.error('Error fetching student quizzes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quizzes' },
      { status: 500 }
    );
  }
}

