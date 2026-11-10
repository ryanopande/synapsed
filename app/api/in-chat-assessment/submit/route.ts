import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invokeAgent } from '@/lib/agent/simple-agent';
import { ConversationService } from '@/lib/agent/conversation-service';

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

    // First, get conversation to determine actualConversationId before creating assessment
    // Note: conversationId might actually be a threadId (from frontend)
    let conversation = null;
    let threadId: string | undefined = undefined;
    let actualConversationId: string | null = null;
    
    if (conversationId) {
      // Check if conversationId is actually a threadId (starts with "thread_")
      if (conversationId.startsWith('thread_')) {
        conversation = await ConversationService.getConversationByThreadId(conversationId);
        if (conversation) {
          threadId = conversation.threadId;
          actualConversationId = conversation.id;
        }
      } else {
        // Try to find by actual conversation ID (ObjectId)
        conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });
        if (conversation) {
          threadId = conversation.threadId;
          actualConversationId = conversation.id;
        }
      }
    }
    
    // If no conversation found but we have userId, get or create one
    if (!conversation && userId) {
      conversation = await ConversationService.getOrCreateConversation({
        userId,
        classId: classId || undefined,
        lessonId: lessonId || undefined,
        threadId: conversationId?.startsWith('thread_') ? conversationId : undefined,
      });
      threadId = conversation.threadId;
      actualConversationId = conversation.id;
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
      // Use actualConversationId (ObjectId) if we found a conversation, otherwise null
      // Don't use conversationId directly as it might be a threadId
      assessment = await prisma.inChatAssessment.create({
        data: {
          topic: inChatAssessmentData.topic,
          nodeTitle: inChatAssessmentData.nodeTitle || null,
          fields: inChatAssessmentData.fields,
          schema: inChatAssessmentData.schema,
          correctAnswers: inChatAssessmentData.correctAnswers || {},
          conversationId: actualConversationId || null, // Use actual ObjectId, not threadId
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
          // MultiSelect: Check if student selected all correct answers
          const studentArray = Array.isArray(studentAnswer) ? studentAnswer : [];
          const correctArray = correctAnswer.map(String);
          const studentArrayStr = studentArray.map(String);
          
          // Check if arrays match (same length and same values)
          if (studentArrayStr.length === correctArray.length &&
              correctArray.every(val => studentArrayStr.includes(val))) {
            correctCount++;
          }
        } else if (typeof correctAnswer === 'boolean') {
          // Checkbox: Exact boolean match
          if (studentAnswer === correctAnswer) {
            correctCount++;
          }
        } else if (typeof correctAnswer === 'number') {
          // Number: Exact numeric match
          const studentNum = typeof studentAnswer === 'number' ? studentAnswer : parseFloat(String(studentAnswer));
          if (!isNaN(studentNum) && studentNum === correctAnswer) {
            correctCount++;
          }
        } else {
          // Text, textarea, select, radio: String comparison (case-insensitive, trimmed)
          const studentStr = String(studentAnswer).toLowerCase().trim();
          const correctStr = String(correctAnswer).toLowerCase().trim();
          
          // For textarea, also check if answer contains key phrases
          const field = inChatAssessmentData.fields.find((f: { name: string }) => f.name === key);
          if (field?.type === 'textarea') {
            // For textarea, check if student answer contains the correct answer or vice versa
            if (studentStr.includes(correctStr) || correctStr.includes(studentStr)) {
              correctCount++;
            }
          } else {
            // Exact match for other types
            if (studentStr === correctStr) {
            correctCount++;
            }
          }
        }
      });

      if (totalQuestions > 0) {
        score = (correctCount / totalQuestions) * 100;
      }
    }

    // Transform responses to use question labels as keys (for professor review)
    // Keep field names for internal processing, but save formatted version to DB
    const formattedResponses: Record<string, string | number | boolean | string[]> = {};
    inChatAssessmentData.fields.forEach((field: { name: string; label: string }) => {
      const answer = responses[field.name];
      if (answer !== undefined && answer !== null && answer !== '') {
        // Use question label as key instead of field name
        formattedResponses[field.label] = answer;
      }
    });
    
    // Save in-chat assessment response (this is independent of conversation, so save immediately)
    // Save formatted responses with question labels for professor review
    const assessmentResponse = await prisma.inChatAssessmentResponse.create({
      data: {
        assessmentId: assessment.id,
        studentId: userId,
        responses: formattedResponses, // Save with question labels as keys
        score,
      },
    });

    // Prepare submission message for agent context (also use formatted version for readability)
    const submissionMessage = `I just completed the assessment on "${inChatAssessmentData.topic}".\n\n${Object.entries(formattedResponses).map(([question, answer]) => {
      const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : String(answer);
      return `Question: ${question}\nAnswer: ${formattedAnswer}`;
    }).join('\n\n')}${score !== null ? `\n\nI scored ${score.toFixed(0)}%.` : ''}`;

    // Generate AI feedback FIRST - this saves to checkpointer automatically
    // Only save messages to Prisma AFTER successful agent invocation to maintain consistency
    // This ensures checkpointer and Prisma stay in sync
    let feedback = '';
    
    try {
      // Create a prompt that includes the submission details
      const feedbackPrompt = `The student just completed an assessment on "${inChatAssessmentData.topic}". 

Their submission:
${submissionMessage}

The correct answers were:
${JSON.stringify(inChatAssessmentData.correctAnswers || {}, null, 2)}

${score !== null ? `Their score was ${score.toFixed(0)}%.` : ''}

Please provide constructive, encouraging feedback based on their submission:
1. Acknowledge what they got right
2. Gently correct any misunderstandings
3. Provide brief explanations for incorrect answers
4. Encourage continued learning
5. Keep it concise (2-3 paragraphs max)

Be supportive and educational, not judgmental.`;

      // Use conversation's threadId for memory continuity, or generate temporary one if no conversation
      const agentThreadId = threadId || `assessment-feedback-${userId}-${Date.now()}`;
      
      // Invoke agent FIRST - this saves submission message and feedback to checkpointer
      const agentResponse = await invokeAgent(
        feedbackPrompt,
        agentThreadId,
        classId,
        userId,
        conversation?.id
      );

      feedback = agentResponse.content;
      
      // Agent invocation successful - now save messages to Prisma
      // This ensures checkpointer and Prisma are in sync
      if (conversation) {
        try {
          // Save submission message AFTER successful agent invocation
          await ConversationService.saveMessage({
            conversationId: conversation.id,
            role: 'USER',
            content: submissionMessage,
          });

          // Save feedback as assistant message
          await ConversationService.saveMessage({
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: feedback,
          });
        } catch (saveError) {
          console.error('Error saving messages to conversation:', saveError);
          // Don't fail the request if message save fails - checkpointer has the messages
        }
      }
    } catch (error) {
      // Agent invocation failed - don't save to Prisma to maintain consistency
      // Since we save after agent invocation, no rollback needed
      // The checkpointer won't have the messages either, so they stay in sync
      console.error('Error generating feedback:', error);
      feedback = score !== null
        ? `Thank you for completing the assessment! You scored ${score.toFixed(0)}%. Keep up the great work!`
        : 'Thank you for completing the assessment!';
      // Note: Assessment response is already saved, which is fine - it's independent data
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

