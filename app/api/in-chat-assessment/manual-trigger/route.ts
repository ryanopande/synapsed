import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { invokeAgent } from '@/lib/agent/tutorAgent';
import { ConversationService } from '@/lib/agent/conversationService';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;
    const userId = user.id;

    const body = await request.json();
    const { topic, nodeTitle, classId, lessonId } = body;

    if (!topic) {
      return NextResponse.json(
        { error: 'Missing required field: topic' },
        { status: 400 }
      );
    }

    // The quiz is saved under the student's lesson conversation, which is how submissions
    // are tied back to the student who received it.
    const conversation = await ConversationService.getOrCreateConversation({
      userId,
      classId: classId || undefined,
      lessonId: lessonId || undefined,
    });

    // Create a prompt that will trigger the agent to use createInChatAssessment tool
    const prompt = `Please create an in-chat assessment to evaluate my understanding of: "${topic}"${nodeTitle ? ` (related to: ${nodeTitle})` : ''}.

Generate 3-5 questions at an intermediate difficulty level that will help me test my knowledge. Use the createInChatAssessment tool to generate the in-chat assessment form.`;

    // Invoke agent with the prompt
    const agentResponse = await invokeAgent(
      prompt,
      conversation.threadId,
      classId,
      userId,
      conversation.id,
      lessonId
    );

    if (!agentResponse.inChatAssessmentData) {
      return NextResponse.json(
        { error: 'Agent did not generate an in-chat assessment. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inChatAssessmentData: agentResponse.inChatAssessmentData,
      message: agentResponse.content,
    });
  } catch (error) {
    console.error('Error triggering in-chat assessment:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger in-chat assessment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

