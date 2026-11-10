import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { questionsMissingAnswerKey } from '@/lib/quizzes/grading';

// POST: Publish or archive a quiz
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { quizId } = await params;

    // Verify quiz exists and professor owns it
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: {
        professorId: true,
        status: true,
        questions: { select: { order: true, type: true, options: { select: { isCorrect: true } } } },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    // 'publish' | 'archive' | 'update-due-date', optional dueDate (ISO string or null)
    const { action, dueDate } = body;

    if (action !== 'publish' && action !== 'archive' && action !== 'update-due-date') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "publish", "archive" or "update-due-date"' },
        { status: 400 }
      );
    }

    // Students can't be auto-graded without an answer key, so require one before publishing
    if (action === 'publish') {
      if (quiz.questions.length === 0) {
        return NextResponse.json({ error: 'Add at least one question before publishing' }, { status: 400 });
      }
      const missing = questionsMissingAnswerKey(quiz.questions);
      if (missing.length > 0) {
        const numbers = missing.map((q) => q.order).sort((a, b) => a - b).join(', ');
        return NextResponse.json(
          {
            error: `Mark the correct answer for question${missing.length === 1 ? '' : 's'} ${numbers} before publishing`,
          },
          { status: 400 }
        );
      }
    }

    // Parse dueDate if provided
    let parsedDueDate: Date | null = null;
    if (dueDate && action !== 'archive') {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid due date format' },
          { status: 400 }
        );
      }
      if (parsedDueDate.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'The due date must be in the future' },
          { status: 400 }
        );
      }
    }

    // Change only the due date of a quiz that's already published
    if (action === 'update-due-date') {
      if (quiz.status !== 'PUBLISHED') {
        return NextResponse.json(
          { error: 'Only published quizzes have a due date to change' },
          { status: 400 }
        );
      }
      const updated = await prisma.professorQuiz.update({
        where: { id: quizId },
        data: { dueDate: parsedDueDate },
      });
      return NextResponse.json({ quiz: updated });
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

