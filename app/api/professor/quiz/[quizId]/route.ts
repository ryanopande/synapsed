import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { regradeQuiz, saveQuizQuestions } from '@/lib/quizzes/grading';

// GET: Get a single quiz
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { quizId } = await params;

    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: { order: 'asc' },
        },
        class: {
          select: {
            id: true,
            title: true,
            professorId: true,
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz' },
      { status: 500 }
    );
  }
}

// PUT: Update a quiz
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { quizId } = await params;

    // Verify quiz exists and professor owns it
    const existingQuiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: { professorId: true },
    });

    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (existingQuiz.professorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { title, description, questions } = body;

    // Update quiz
    await prisma.professorQuiz.update({
      where: { id: quizId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    // Update questions in place so existing student answers stay attached, then
    // re-grade any submissions in case the answer key changed.
    let idMap: Record<string, string> = {};
    if (questions && Array.isArray(questions)) {
      idMap = await saveQuizQuestions(quizId, questions);
      const hasResponses = await prisma.professorQuizResponse.count({ where: { quizId } });
      if (hasResponses > 0) {
        await regradeQuiz(quizId);
      }
    }

    const updatedQuiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: { orderBy: { order: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ quiz: updatedQuiz, idMap });
  } catch (error) {
    console.error('Error updating quiz:', error instanceof Error ? error.message : String(error));
    const errorMessage = error instanceof Error ? error.message : 'Failed to update quiz';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE: Delete a quiz
export async function DELETE(
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
      select: { professorId: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete quiz (cascade will delete questions, options, responses, answers)
    await prisma.professorQuiz.delete({
      where: { id: quizId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return NextResponse.json(
      { error: 'Failed to delete quiz' },
      { status: 500 }
    );
  }
}

