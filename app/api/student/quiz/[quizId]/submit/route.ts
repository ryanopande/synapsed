import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { QuizSubmitRequest, QuizSubmitResponse } from '@/lib/types/quizzes';

interface QuizAnswerInput {
  responseId: string;
  questionId: string;
  answerText: string | null;
  optionId: string | null;
  isCorrect: boolean;
}

// POST: Submit quiz answers
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
    const body: QuizSubmitRequest = await request.json();
    const { studentId, classId, answers } = body;

    if (!studentId || !classId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify quiz exists and is published
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Quiz is not available' }, { status: 403 });
    }

    // Verify student is enrolled
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        classId,
        studentId,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this class' }, { status: 403 });
    }

    // Check if already submitted
    const existingResponse = await prisma.professorQuizResponse.findFirst({
      where: {
        quizId,
        studentId,
      },
    });

    if (existingResponse) {
      return NextResponse.json({ error: 'Quiz already submitted' }, { status: 400 });
    }

    // Calculate score
    let correctCount = 0;
    const totalQuestions = quiz.questions.length;

    // Validate that all answers correspond to valid questions
    const invalidAnswers = answers.filter(
      ans => !quiz.questions.some(q => q.id === ans.questionId)
    );
    
    if (invalidAnswers.length > 0) {
      return NextResponse.json(
        { error: 'Some answers reference invalid questions' },
        { status: 400 }
      );
    }

    const quizAnswers: QuizAnswerInput[] = answers
      .map((ans) => {
        const question = quiz.questions.find(q => q.id === ans.questionId);
        if (!question) {
          return null;
        }

        let isCorrect = false;
        let selectedOption: { id: string; isCorrect: boolean } | undefined;
        
        if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
          selectedOption = question.options.find(opt => opt.text === ans.answerText);
          isCorrect = selectedOption?.isCorrect || false;
          if (isCorrect) correctCount++;
        } else if (question.type === 'SHORT_ANSWER') {
          // Short answers are not auto-graded, marked as false
          isCorrect = false; // Will be manually graded
        }

        return {
          responseId: '', // Will be set after creating response
          questionId: ans.questionId,
          answerText: question.type === 'SHORT_ANSWER' ? ans.answerText : null,
          optionId: selectedOption?.id || null,
          isCorrect,
        };
      })
      .filter((ans): ans is QuizAnswerInput => ans !== null);

    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Create response and answers
    const response = await prisma.professorQuizResponse.create({
      data: {
        quizId,
        studentId,
        score,
        submittedAt: new Date(),
        answers: {
          create: quizAnswers.map((ans) => ({
            questionId: ans.questionId,
            answerText: ans.answerText,
            optionId: ans.optionId,
            isCorrect: ans.isCorrect,
          })),
        },
      },
    });

    const submitResponse: QuizSubmitResponse = {
      success: true,
      responseId: response.id,
      score,
      totalQuestions,
      correctCount,
    };

    return NextResponse.json(submitResponse, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error submitting quiz:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
    });
    return NextResponse.json(
      { error: 'Failed to submit quiz', details: errorMessage },
      { status: 500 }
    );
  }
}

