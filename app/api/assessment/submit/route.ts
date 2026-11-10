import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invokeAgent } from '@/lib/agent/simple-agent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assessmentId,
      inChatAssessmentData,
      responses,
      conversationId,
      classId,
      lessonId,
      userId,
    } = body;

    if (!inChatAssessmentData || !responses || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: inChatAssessmentData, responses, or userId' },
        { status: 400 }
      );
    }

    // Create or find in-chat assessment record
    let assessment;
    if (assessmentId) {
      assessment = await prisma.inChatAssessment.findUnique({
        where: { id: assessmentId },
      });
    }

    if (!assessment) {
      // Create new in-chat assessment record
      assessment = await prisma.inChatAssessment.create({
        data: {
          topic: inChatAssessmentData.topic,
          nodeTitle: inChatAssessmentData.nodeTitle || null,
          fields: inChatAssessmentData.fields,
          schema: inChatAssessmentData.schema,
          correctAnswers: inChatAssessmentData.correctAnswers || {},
          conversationId: conversationId || null,
          nodeId: lessonId || null,
        },
      });
    }

    // Calculate score if correct answers are provided
    let score: number | null = null;
    if (inChatAssessmentData.correctAnswers) {
      const correctAnswers = inChatAssessmentData.correctAnswers;
      let correctCount = 0;
      let totalQuestions = 0;

      Object.keys(correctAnswers).forEach((key) => {
        totalQuestions++;
        const correctAnswer = correctAnswers[key];
        const studentAnswer = responses[key];

        if (Array.isArray(correctAnswer)) {
          // Multiple correct answers
          if (correctAnswer.includes(studentAnswer)) {
            correctCount++;
          }
        } else {
          // Single correct answer
          if (String(studentAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim()) {
            correctCount++;
          }
        }
      });

      if (totalQuestions > 0) {
        score = (correctCount / totalQuestions) * 100;
      }
    }

    // Save in-chat assessment response
    const assessmentResponse = await prisma.inChatAssessmentResponse.create({
      data: {
        assessmentId: assessment.id,
        studentId: userId,
        responses,
        score,
      },
    });

    // Generate AI feedback
    let feedback = '';
    try {
      const feedbackPrompt = `A student just completed an in-chat assessment on "${inChatAssessmentData.topic}". 

Their answers were:
${JSON.stringify(responses, null, 2)}

The correct answers were:
${JSON.stringify(inChatAssessmentData.correctAnswers || {}, null, 2)}

${score !== null ? `Their score was ${score.toFixed(0)}%.` : ''}

Please provide constructive, encouraging feedback:
1. Acknowledge what they got right
2. Gently correct any misunderstandings
3. Provide brief explanations for incorrect answers
4. Encourage continued learning
5. Keep it concise (2-3 paragraphs max)

Be supportive and educational, not judgmental.`;

      const agentResponse = await invokeAgent(
        feedbackPrompt,
        undefined, // threadId - could use conversation threadId if available
        classId,
        userId
      );

      feedback = agentResponse.content;
    } catch (error) {
      console.error('Error generating feedback:', error);
      feedback = score !== null
        ? `Thank you for completing the in-chat assessment! You scored ${score.toFixed(0)}%. Keep up the great work!`
        : 'Thank you for completing the in-chat assessment!';
    }

    // Update response with feedback
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

