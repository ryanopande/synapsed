import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET: Get student's quiz results (submitted quiz with answers)
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

    // Get student's response
    const response = await prisma.professorQuizResponse.findFirst({
      where: {
        quizId,
        studentId,
      },
      include: {
        answers: true,
      },
    });

    if (!response || !response.submittedAt) {
      return NextResponse.json({ error: 'Quiz not submitted yet' }, { status: 404 });
    }

    // Get all questions for this quiz with options
    const quizQuestions = await prisma.professorQuizQuestion.findMany({
      where: { quizId },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Create a map of questions by ID for quick lookup
    const questionMap = new Map(
      quizQuestions.map((q) => [q.id, q])
    );

    // Format response with answers and questions
    const formattedAnswers = response.answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new Error(`Question ${answer.questionId} not found`);
      }
      
      return {
        id: answer.id,
        questionId: answer.questionId,
        question: {
          id: question.id,
          text: question.text,
          richTextContent: question.richTextContent,
          type: question.type.toLowerCase().replace('_', '-') as 'multiple-choice' | 'short-answer' | 'true-false',
          imageUrl: question.imageUrl,
          order: question.order,
          options: question.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: opt.order,
          })),
        },
        answerText: answer.answerText,
        optionId: answer.optionId,
        isCorrect: answer.isCorrect,
      };
    });

    return NextResponse.json({
      id: response.id,
      quizId: quiz.id,
      quizTitle: quiz.title,
      quizDescription: quiz.description,
      studentId: response.studentId,
      score: response.score,
      submittedAt: response.submittedAt,
      answers: formattedAnswers,
    });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz results' },
      { status: 500 }
    );
  }
}


