import { NextRequest, NextResponse } from 'next/server';
import { invokeAgent } from '@/lib/agent/simple-agent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, nodeTitle, classId, userId, threadId } = body;

    if (!topic || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: topic and userId' },
        { status: 400 }
      );
    }

    // Create a prompt that will trigger the agent to use createInChatAssessment tool
    const prompt = `Please create an in-chat assessment to evaluate my understanding of: "${topic}"${nodeTitle ? ` (related to: ${nodeTitle})` : ''}.

Generate 3-5 questions at an intermediate difficulty level that will help me test my knowledge. Use the createInChatAssessment tool to generate the in-chat assessment form.`;

    // Invoke agent with the prompt
    const agentResponse = await invokeAgent(
      prompt,
      threadId,
      classId,
      userId
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

