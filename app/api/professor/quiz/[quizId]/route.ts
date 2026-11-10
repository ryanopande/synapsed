import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { QuestionInput, QuestionOptionInput } from '@/lib/types/quizzes';
import { Prisma } from '@prisma/client';

// GET: Get a single quiz
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

    if (quiz.professorId !== session.user.id) {
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId } = await params;

    // Verify quiz exists and professor owns it
    const existingQuiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: { professorId: true },
    });

    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (existingQuiz.professorId !== session.user.id) {
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
    const quiz = await prisma.professorQuiz.update({
      where: { id: quizId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    // If questions are provided, update them
    if (questions && Array.isArray(questions)) {
      // Delete existing questions and options (cascade will handle options)
      await prisma.professorQuizQuestion.deleteMany({
        where: { quizId },
      });

      // Only create questions if array is not empty
      if (questions.length > 0) {
        // Create new questions
        await prisma.professorQuizQuestion.createMany({
          data: questions.map((q: QuestionInput, index: number) => ({
            quizId,
            text: q.text || '',
            richTextContent: (q.richTextContent || null) as Prisma.InputJsonValue,
            type: (typeof q.type === 'string' ? q.type.toUpperCase().replace('-', '_') : q.type) as 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'TRUE_FALSE',
            imageUrl: q.imageUrl || null,
            order: q.order || index + 1,
          })),
        });

        // Get created questions to add options
        const createdQuestions = await prisma.professorQuizQuestion.findMany({
          where: { quizId },
          orderBy: { order: 'asc' },
        });

        // Create options for each question
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const createdQuestion = createdQuestions[i];
          
          if (question.options && Array.isArray(question.options) && createdQuestion) {
            await prisma.professorQuizOption.createMany({
              data: question.options.map((opt: QuestionOptionInput, optIndex: number) => ({
                questionId: createdQuestion.id,
                text: opt.text || '',
                isCorrect: opt.isCorrect || false,
                order: opt.order || optIndex + 1,
              })),
            });
          }
        }
      }

      // Fetch updated quiz
      const updatedQuiz = await prisma.professorQuiz.findUnique({
        where: { id: quizId },
        include: {
          questions: {
            include: {
              options: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      return NextResponse.json({ quiz: updatedQuiz });
    }

    return NextResponse.json({ quiz });
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

