import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CreateQuizRequest, QuestionInput, QuestionOptionInput } from '@/lib/types/quizzes';
import { Prisma } from '@prisma/client';

// GET: List all quizzes for a class
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

    // Verify professor owns this class
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { professorId: true },
    });

    if (!classRecord || classRecord.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all quizzes for this class
    const quizzes = await prisma.professorQuiz.findMany({
      where: { classId },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: { order: 'asc' },
        },
        responses: {
          select: {
            id: true,
            studentId: true,
            score: true,
            submittedAt: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get total students enrolled in class
    const totalStudents = await prisma.classEnrollment.count({
      where: { classId },
    });

    // Transform to match frontend Quiz type
    const transformedQuizzes = quizzes.map(quiz => {
      const submissions = quiz._count.responses;
      const scores = quiz.responses
        .map(r => r.score)
        .filter((s): s is number => s !== null);
      const gradeAverage = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : undefined;

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        status: quiz.status.toLowerCase() as 'draft' | 'published' | 'archived',
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        publishedAt: quiz.publishedAt,
        submissions,
        totalStudents,
        gradeAverage,
        questions: quiz.questions.map(q => ({
          id: q.id,
          text: q.text,
          richTextContent: q.richTextContent,
          type: q.type.toLowerCase().replace('_', '-') as 'multiple-choice' | 'short-answer' | 'true-false',
          imageUrl: q.imageUrl,
          order: q.order,
          options: q.options.map(opt => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: opt.order,
          })),
        })),
      };
    });

    return NextResponse.json({ quizzes: transformedQuizzes });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quizzes' },
      { status: 500 }
    );
  }
}

// POST: Create a new quiz
export async function POST(
  request: NextRequest,
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

    const body: CreateQuizRequest = await request.json();
    const { title, description, questions } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Create quiz with questions and options
    const quiz = await prisma.professorQuiz.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        classId,
        professorId: session.user.id,
        status: 'DRAFT',
        questions: questions && Array.isArray(questions) ? {
          create: questions.map((q: QuestionInput, index: number) => ({
            text: q.text || '',
            richTextContent: (q.richTextContent ?? null) as Prisma.InputJsonValue | null,
            type: (typeof q.type === 'string' ? q.type.toUpperCase().replace('-', '_') : q.type) as 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'TRUE_FALSE',
            imageUrl: q.imageUrl || null,
            order: q.order || index + 1,
            options: q.options && Array.isArray(q.options) ? {
              create: q.options.map((opt: QuestionOptionInput, optIndex: number) => ({
                text: opt.text || '',
                isCorrect: opt.isCorrect || false,
                order: opt.order || optIndex + 1,
              })),
            } : undefined,
          })),
        } : undefined,
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

    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    console.error('Error creating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to create quiz' },
      { status: 500 }
    );
  }
}

