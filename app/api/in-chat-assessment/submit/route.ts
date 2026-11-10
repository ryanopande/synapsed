import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { invokeAgent } from '@/lib/agent/tutorAgent';
import { ConversationService } from '@/lib/agent/conversationService';

type AnswerValue = string | number | boolean | string[];
type FieldMeta = { name: string; label: string; type?: string };

/** Score answers against the saved answer key (same rules as before, now server-side only). */
function scoreAnswers(
  correctAnswers: Record<string, AnswerValue>,
  responses: Record<string, unknown>,
  fields: FieldMeta[]
): number | null {
  const keys = Object.keys(correctAnswers);
  if (keys.length === 0) return null;
  let correctCount = 0;

  for (const key of keys) {
    const correctAnswer = correctAnswers[key];
    const studentAnswer = responses[key];

    if (Array.isArray(correctAnswer)) {
      // MultiSelect: Check if student selected all correct answers
      const studentArray = Array.isArray(studentAnswer) ? studentAnswer.map(String) : [];
      const correctArray = correctAnswer.map(String);
      if (studentArray.length === correctArray.length && correctArray.every((val) => studentArray.includes(val))) {
        correctCount++;
      }
    } else if (typeof correctAnswer === 'boolean') {
      // Checkbox: Exact boolean match
      if (studentAnswer === correctAnswer) correctCount++;
    } else if (typeof correctAnswer === 'number') {
      // Number: Exact numeric match
      const studentNum = typeof studentAnswer === 'number' ? studentAnswer : parseFloat(String(studentAnswer));
      if (!isNaN(studentNum) && studentNum === correctAnswer) correctCount++;
    } else {
      // Text, textarea, select, radio: String comparison (case-insensitive, trimmed)
      const studentStr = String(studentAnswer ?? '').toLowerCase().trim();
      const correctStr = String(correctAnswer).toLowerCase().trim();
      const field = fields.find((f) => f.name === key);
      if (field?.type === 'textarea') {
        // For textarea, check if student answer contains the correct answer or vice versa
        if (studentStr && (studentStr.includes(correctStr) || correctStr.includes(studentStr))) correctCount++;
      } else if (studentStr === correctStr) {
        correctCount++;
      }
    }
  }

  return (correctCount / keys.length) * 100;
}

/**
 * POST: Submit a pop quiz (in-chat assessment).
 * The quiz must be one the tutor created and saved in the signed-in student's own conversation;
 * it is scored against the saved answer key (never one sent by the browser) and can be submitted once.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;
    const userId = user.id;

    const body = await request.json();
    const { assessmentId, responses } = body as { assessmentId?: string; responses?: Record<string, unknown> };

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'Missing quiz answers' }, { status: 400 });
    }
    if (!assessmentId || !/^[a-f0-9]{24}$/i.test(assessmentId)) {
      return NextResponse.json(
        { error: 'This quiz has expired. Ask the tutor for a new quiz.' },
        { status: 400 }
      );
    }

    const assessment = await prisma.inChatAssessment.findUnique({
      where: { id: assessmentId },
      include: { conversation: true },
    });
    if (!assessment) {
      return NextResponse.json({ error: 'Quiz not found. Ask the tutor for a new quiz.' }, { status: 404 });
    }
    // Only the student whose conversation the quiz was created in can submit it
    if (!assessment.conversation || assessment.conversation.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // One submission per quiz: retries mean asking for a fresh quiz, not resubmitting after feedback
    const existing = await prisma.inChatAssessmentResponse.findFirst({
      where: { assessmentId: assessment.id, studentId: userId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'You already submitted this quiz. Ask the tutor for a new one to try again.' },
        { status: 409 }
      );
    }

    const conversation = assessment.conversation;
    const classId = conversation.classId ?? undefined;
    const lessonId = assessment.nodeId ?? undefined;
    const fields = (Array.isArray(assessment.fields) ? assessment.fields : []) as unknown as FieldMeta[];
    const correctAnswers = (assessment.correctAnswers ?? {}) as Record<string, AnswerValue>;
    const score = scoreAnswers(correctAnswers, responses, fields);

    // Save responses with question labels as keys (for professor review)
    const formattedResponses: Record<string, AnswerValue> = {};
    for (const field of fields) {
      const answer = responses[field.name];
      if (answer !== undefined && answer !== null && answer !== '') {
        formattedResponses[field.label] = answer as AnswerValue;
      }
    }

    const assessmentResponse = await prisma.inChatAssessmentResponse.create({
      data: {
        assessmentId: assessment.id,
        studentId: userId,
        responses: formattedResponses,
        score,
      },
    });

    // Prepare submission message for agent context
    const submissionMessage = `I just completed the assessment on "${assessment.topic}".\n\n${Object.entries(formattedResponses).map(([question, answer]) => {
      const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : String(answer);
      return `Question: ${question}\nAnswer: ${formattedAnswer}`;
    }).join('\n\n')}${score !== null ? `\n\nI scored ${score.toFixed(0)}%.` : ''}`;

    // Generate AI feedback first (saves to the checkpointer), then mirror the turn into Prisma
    let feedback = '';
    try {
      const feedbackPrompt = `The student just completed an assessment on "${assessment.topic}".

Their submission:
${submissionMessage}

The correct answers were:
${JSON.stringify(correctAnswers, null, 2)}

${score !== null ? `Their score was ${score.toFixed(0)}%.` : ''}

Please provide constructive, encouraging feedback based on their submission:
1. Acknowledge what they got right
2. Gently correct any misunderstandings
3. Provide brief explanations for incorrect answers
4. Encourage continued learning
5. Keep it concise (2-3 paragraphs max)

Be supportive and educational, not judgmental.`;

      const agentResponse = await invokeAgent(
        feedbackPrompt,
        conversation.threadId,
        classId,
        userId,
        conversation.id,
        lessonId
      );
      feedback = agentResponse.content;

      try {
        await ConversationService.saveMessage({
          conversationId: conversation.id,
          role: 'USER',
          content: submissionMessage,
        });
        await ConversationService.saveMessage({
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: feedback,
        });
      } catch (saveError) {
        console.error('Error saving messages to conversation:', saveError);
      }
    } catch (error) {
      console.error('Error generating feedback:', error);
      feedback = score !== null
        ? `Thank you for completing the assessment! You scored ${score.toFixed(0)}%. Keep up the great work!`
        : 'Thank you for completing the assessment!';
    }

    await prisma.inChatAssessmentResponse.update({
      where: { id: assessmentResponse.id },
      data: { feedback },
    });

    return NextResponse.json({
      success: true,
      assessmentId: assessment.id,
      responseId: assessmentResponse.id,
      score,
      feedback,
    });
  } catch (error) {
    console.error('Error submitting in-chat assessment:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit in-chat assessment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
