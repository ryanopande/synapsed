import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { CreateQuizRequest } from '@/lib/types/quizzes';
import { saveQuizQuestions } from '@/lib/quizzes/grading';

// GET: List all quizzes for a class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { classId } = await params;

    // Verify professor owns this class
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { professorId: true },
    });

    if (!classRecord || classRecord.professorId !== user.id) {
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
        dueDate: quiz.dueDate,
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
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { classId } = await params;

    // Verify professor owns this class
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { professorId: true },
    });

    if (!classRecord || classRecord.professorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: CreateQuizRequest = await request.json();
    const { title, description, questions } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Create the quiz, then its questions (shared with quiz updates so ids map the same way)
    const created = await prisma.professorQuiz.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        classId,
        professorId: user.id,
        status: 'DRAFT',
      },
      select: { id: true },
    });
    const idMap = questions && Array.isArray(questions)
      ? await saveQuizQuestions(created.id, questions)
      : {};

    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: created.id },
      include: {
        questions: {
          include: {
            options: { orderBy: { order: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ quiz, idMap }, { status: 201 });
  } catch (error) {
    console.error('Error creating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to create quiz' },
      { status: 500 }
    );
  }
}

