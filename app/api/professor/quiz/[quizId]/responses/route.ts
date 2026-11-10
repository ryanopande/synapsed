import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET: Get all student responses for a quiz
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

    // Verify quiz exists and professor owns it
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        professorId: true,
        classId: true,
        questions: {
          include: {
            options: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all enrolled students for this class
    const enrolledStudents = await prisma.classEnrollment.findMany({
      where: { classId: quiz.classId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get all questions for this quiz (needed to join with answers)
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

    // Get all responses for this quiz
    const responses = await prisma.professorQuizResponse.findMany({
      where: { quizId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        answers: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Create a map of student responses
    const responseMap = new Map(
      responses.map((r) => [r.studentId, r])
    );

    // Build student list with their submission status
    const students = enrolledStudents.map((enrollment) => {
      const response = responseMap.get(enrollment.student.id);
      
      let status: 'submitted' | 'in-progress' | 'not-started' = 'not-started';
      if (response) {
        status = response.submittedAt ? 'submitted' : 'in-progress';
      }

      return {
        id: enrollment.student.id,
        name: enrollment.student.name || enrollment.student.email,
        email: enrollment.student.email,
        status,
        submittedAt: response?.submittedAt || null,
        score: response?.score || null,
        responseId: response?.id || null,
      };
    });

    // Format responses with answers
    const formattedResponses = responses.map((response) => {
      if (!response.student) {
        throw new Error('Student relation not loaded');
      }
      
      return {
        id: response.id,
        studentId: response.studentId,
        studentName: response.student.name || response.student.email,
        studentEmail: response.student.email,
        score: response.score,
        submittedAt: response.submittedAt,
        answers: response.answers.map((answer) => {
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
        }),
      };
    });

    return NextResponse.json({
      students,
      responses: formattedResponses,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          text: q.text,
          richTextContent: q.richTextContent,
          type: q.type.toLowerCase().replace('_', '-') as 'multiple-choice' | 'short-answer' | 'true-false',
          imageUrl: q.imageUrl,
          order: q.order,
          options: q.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: opt.order,
          })),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching quiz responses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz responses' },
      { status: 500 }
    );
  }
}

