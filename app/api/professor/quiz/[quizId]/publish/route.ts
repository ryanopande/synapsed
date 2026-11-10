import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// POST: Publish or archive a quiz
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId } = await params;

    // Verify quiz exists and professor owns it
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: { professorId: true, status: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, dueDate } = body; // 'publish' or 'archive', optional dueDate

    if (action !== 'publish' && action !== 'archive') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "publish" or "archive"' },
        { status: 400 }
      );
    }

    // Parse dueDate if provided
    let parsedDueDate: Date | null = null;
    if (dueDate && action === 'publish') {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid due date format' },
          { status: 400 }
        );
      }
    }

    // Update quiz status
    const updatedQuiz = await prisma.professorQuiz.update({
      where: { id: quizId },
      data: {
        status: action === 'publish' ? 'PUBLISHED' : 'ARCHIVED',
        publishedAt: action === 'publish' ? new Date() : undefined,
        dueDate: action === 'publish' ? parsedDueDate : null,
      },
    });

    return NextResponse.json({ quiz: updatedQuiz });
  } catch (error) {
    console.error('Error updating quiz status:', error);
    return NextResponse.json(
      { error: 'Failed to update quiz status' },
      { status: 500 }
    );
  }
}

