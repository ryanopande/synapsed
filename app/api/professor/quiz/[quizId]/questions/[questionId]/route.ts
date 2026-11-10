import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UpdateQuestionRequest, QuestionOptionInput } from '@/lib/types/quizzes';
import { Prisma } from '@prisma/client';

// PUT: Update a question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId, questionId } = await params;

    // Verify quiz exists and professor owns it
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: { professorId: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify question belongs to quiz
    const existingQuestion = await prisma.professorQuizQuestion.findUnique({
      where: { id: questionId },
      select: { quizId: true },
    });

    if (!existingQuestion || existingQuestion.quizId !== quizId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const body: UpdateQuestionRequest = await request.json();
    const { text, richTextContent, type, imageUrl, order, options } = body;

    // Update question
    const question = await prisma.professorQuizQuestion.update({
      where: { id: questionId },
      data: {
        ...(text !== undefined && { text: text.trim() }),
        ...(richTextContent !== undefined && { richTextContent: richTextContent as Prisma.InputJsonValue }),
        ...(type !== undefined && { type: type.toUpperCase().replace('-', '_') as 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'TRUE_FALSE' }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(order !== undefined && { order }),
      },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // If options are provided, update them
    if (options && Array.isArray(options)) {
      // Delete existing options
      await prisma.professorQuizOption.deleteMany({
        where: { questionId },
      });

      // Create new options
      if (options.length > 0) {
        await prisma.professorQuizOption.createMany({
          data: options.map((opt: QuestionOptionInput, optIndex: number) => ({
            questionId,
            text: opt.text || '',
            isCorrect: opt.isCorrect || false,
            order: opt.order || optIndex + 1,
          })),
        });
      }

      // Fetch updated question with options
      const updatedQuestion = await prisma.professorQuizQuestion.findUnique({
        where: { id: questionId },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return NextResponse.json({ question: updatedQuestion });
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId, questionId } = await params;

    // Verify quiz exists and professor owns it
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: { professorId: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify question belongs to quiz
    const question = await prisma.professorQuizQuestion.findUnique({
      where: { id: questionId },
      select: { quizId: true },
    });

    if (!question || question.quizId !== quizId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Delete question (cascade will delete options)
    await prisma.professorQuizQuestion.delete({
      where: { id: questionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
}

