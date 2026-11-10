import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CreateQuestionRequest, QuestionOptionInput } from '@/lib/types/quizzes';
import { Prisma } from '@prisma/client';

// POST: Create a new question for a quiz
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
      select: { professorId: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: CreateQuestionRequest = await request.json();
    const { text, richTextContent, type, imageUrl, order, options } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    if (!type) {
      return NextResponse.json({ error: 'Question type is required' }, { status: 400 });
    }

    // Get current max order to set default
    const maxOrder = await prisma.professorQuizQuestion.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const questionOrder = order || (maxOrder ? maxOrder.order + 1 : 1);

    // Create question
    const question = await prisma.professorQuizQuestion.create({
      data: {
        quizId,
        text: text.trim(),
        richTextContent: (richTextContent || null) as Prisma.InputJsonValue,
        type: type.toUpperCase().replace('-', '_') as 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'TRUE_FALSE',
        imageUrl: imageUrl || null,
        order: questionOrder,
        options: options && Array.isArray(options) ? {
          create: options.map((opt: QuestionOptionInput, optIndex: number) => ({
            text: opt.text || '',
            isCorrect: opt.isCorrect || false,
            order: opt.order || optIndex + 1,
          })),
        } : undefined,
      },
      include: {
        options: true,
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
}

