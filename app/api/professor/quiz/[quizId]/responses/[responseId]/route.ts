import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { computeScore, recalculateResponseScore } from '@/lib/quizzes/grading';

/**
 * PATCH: Professor grades a student's quiz submission.
 * Body:
 *   answers?: [{ answerId, isCorrect: boolean | null }]  mark answers correct/incorrect (null = ungraded)
 *   score?: number | null   set the final score by hand (0-100); null returns to the calculated score
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; responseId: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { quizId, responseId } = await params;
    const response = await prisma.professorQuizResponse.findUnique({
      where: { id: responseId },
      select: { quizId: true, quiz: { select: { professorId: true } }, answers: { select: { id: true } } },
    });
    if (!response || response.quizId !== quizId) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    if (response.quiz.professorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const answerIds = new Set(response.answers.map((a) => a.id));

    if (body.answers !== undefined) {
      if (!Array.isArray(body.answers)) {
        return NextResponse.json({ error: '"answers" must be an array' }, { status: 400 });
      }
      for (const a of body.answers) {
        if (!answerIds.has(a?.answerId) || !(a.isCorrect === null || typeof a.isCorrect === 'boolean')) {
          return NextResponse.json({ error: 'Invalid answer grade' }, { status: 400 });
        }
      }
    }
    if (body.score !== undefined && body.score !== null) {
      if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > 100) {
        return NextResponse.json({ error: 'Score must be a number from 0 to 100' }, { status: 400 });
      }
    }

    for (const a of body.answers ?? []) {
      await prisma.professorQuizAnswer.update({ where: { id: a.answerId }, data: { isCorrect: a.isCorrect } });
    }

    if (typeof body.score === 'number') {
      await prisma.professorQuizResponse.update({
        where: { id: responseId },
        data: { score: body.score, scoreOverridden: true, gradedAt: new Date() },
      });
    } else {
      await prisma.professorQuizResponse.update({
        where: { id: responseId },
        data: { gradedAt: new Date(), ...(body.score === null && { scoreOverridden: false }) },
      });
      await recalculateResponseScore(responseId);
    }

    const updated = await prisma.professorQuizResponse.findUnique({
      where: { id: responseId },
      select: {
        score: true,
        scoreOverridden: true,
        gradedAt: true,
        quiz: { select: { _count: { select: { questions: true } } } },
        answers: { select: { id: true, isCorrect: true } },
      },
    });
    const { pending } = computeScore(updated!.quiz._count.questions, updated!.answers);

    return NextResponse.json({
      score: updated!.score,
      scoreOverridden: !!updated!.scoreOverridden,
      gradedAt: updated!.gradedAt,
      pendingCount: pending,
      answers: updated!.answers,
    });
  } catch (error) {
    console.error('Error grading quiz response:', error);
    return NextResponse.json({ error: 'Failed to save grade' }, { status: 500 });
  }
}
