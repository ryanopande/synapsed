import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { QuizSubmitRequest, QuizSubmitResponse } from '@/lib/types/quizzes';
import { autoGrade, computeScore, isChoiceQuestion } from '@/lib/quizzes/grading';

// POST: Submit quiz answers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { quizId } = await params;
    const body: QuizSubmitRequest = await request.json();
    const { classId, answers } = body;
    // Always submit as the signed-in student, never an id from the request body
    const studentId = user.id;

    if (!classId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (body.studentId && body.studentId !== studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    // Choice questions are graded against the answer key; short answers wait for the professor.
    const quizAnswers = answers.flatMap((ans) => {
      const question = quiz.questions.find(q => q.id === ans.questionId);
      if (!question) return [];
      const graded = autoGrade(question, { optionId: ans.optionId, answerText: ans.answerText });
      const chosenText = question.options.find(o => o.id === graded.optionId)?.text ?? null;
      return [{
        questionId: ans.questionId,
        // Keep the chosen option's text too, so answers can be re-graded if options are edited
        answerText: isChoiceQuestion(question.type) ? chosenText : ans.answerText,
        optionId: graded.optionId,
        isCorrect: graded.isCorrect,
      }];
    });

    const { score, correct: correctCount, pending: pendingCount } = computeScore(totalQuestions, quizAnswers);

    // Create response and answers
    const response = await prisma.professorQuizResponse.create({
      data: {
        quizId,
        studentId,
        score,
        submittedAt: new Date(),
        answers: {
          create: quizAnswers,
        },
      },
    });

    const submitResponse: QuizSubmitResponse = {
      success: true,
      responseId: response.id,
      score,
      totalQuestions,
      correctCount,
      pendingCount,
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

