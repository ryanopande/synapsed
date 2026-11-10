import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET: Get a single quiz for student to take
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || session.user.id;

    // Fetch quiz
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      include: {
        class: true,
        questions: {
          include: {
            options: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
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
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Verify quiz is published
    if (quiz.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Quiz is not available' }, { status: 403 });
    }

    // Verify student is enrolled
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        classId: quiz.classId,
        studentId,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this class' }, { status: 403 });
    }

    // Check if already submitted
    const hasSubmitted = quiz.responses.some(r => r.submittedAt !== null);

    // Remove correct answers from options for student view
    const questionsForStudent = quiz.questions.map(q => ({
      ...q,
      options: q.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        // Don't include isCorrect for students
      })),
    }));

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        dueDate: quiz.dueDate,
        questions: questionsForStudent,
        hasSubmitted,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz' },
      { status: 500 }
    );
  }
}

