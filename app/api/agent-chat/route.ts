import { NextRequest, NextResponse } from 'next/server';
import { invokeAgent } from '@/lib/agent/simple-agent';
import { ConversationService } from '@/lib/agent/conversation-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support both old format (message) and new format (messages array)
    const { message, messages, displayMessage, userId, classId, lessonId, threadId } = body;

    // If using the new format with messages array, extract the last user message
    let userMessage: string;
    if (messages && Array.isArray(messages)) {
      // Get the last message from the user
      const lastUserMessage = messages.filter((m: { role: string; content: string }) => m.role === 'user').pop();
      if (!lastUserMessage) {
        return NextResponse.json(
          { error: 'No user message found in messages array' },
          { status: 400 }
        );
      }
      userMessage = lastUserMessage.content;
    } else if (message && typeof message === 'string') {
      userMessage = message;
    } else {
      return NextResponse.json(
        { error: 'Either "message" or "messages" array with user messages is required' },
        { status: 400 }
      );
    }

    // Get or create conversation for persistence
    let conversation;
    
    if (userId) {
      conversation = await ConversationService.getOrCreateConversation({
        userId,
        classId,
        lessonId,
        threadId, // Use provided threadId if exists, otherwise service will generate
      });
    }

    // Use conversation's threadId if available, otherwise use provided threadId
    const agentThreadId = conversation?.threadId || threadId;

    // Invoke agent FIRST - this saves to checkpointer automatically
    // Only save to Prisma AFTER successful agent invocation to maintain consistency
    // This ensures checkpointer and Prisma stay in sync
    let agentResponse;
    try {
      agentResponse = await invokeAgent(userMessage, agentThreadId, classId, userId, conversation?.id);
      
      // Agent invocation successful - now save messages to Prisma
      // This ensures checkpointer and Prisma are in sync
      if (conversation) {
        try {
          // Save user message AFTER successful agent invocation.
          // Use displayMessage (clean text without any injected mode prompts) when available.
          await ConversationService.saveMessage({
            conversationId: conversation.id,
            role: 'USER',
            content: (displayMessage as string | undefined) || userMessage,
          });

          // Save assistant message
          await ConversationService.saveMessage({
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: agentResponse.content,
            sources: agentResponse.sources,
          });
        } catch (saveError) {
          // Log save error but don't fail the request - user already got the response
          // Checkpointer has the messages, Prisma save failure is less critical
          const saveErrorMessage = saveError instanceof Error ? saveError.message : String(saveError || 'Unknown error');
          console.error('[Database Save Error]', saveErrorMessage);
          console.error('[Database Save Error Context]', {
            conversationId: conversation.id,
            hasSources: !!agentResponse.sources,
            sourcesCount: agentResponse.sources?.length || 0,
            sourcesType: agentResponse.sources ? typeof agentResponse.sources : 'none'
          });
        }
      }
    } catch (agentError) {
      // Agent invocation failed - don't save to Prisma to maintain consistency
      // Since we save after agent invocation, no rollback needed
      // The checkpointer won't have the message either, so they stay in sync
      console.error('[Agent Invocation Error]', agentError instanceof Error ? agentError.message : String(agentError));
      throw agentError; // Re-throw to be handled by outer catch
    }

    const apiResponse = {
      response: agentResponse.content,
      sources: agentResponse.sources,
      inChatAssessmentData: agentResponse.inChatAssessmentData,
      diagramData: agentResponse.diagramData,
      conversationId: conversation?.id,
      threadId: agentThreadId,
    };

    return NextResponse.json(apiResponse);
  } catch (error) {
    // Safely log error - avoid passing error objects directly to prevent Next.js source map issues
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    const errorName = error instanceof Error ? error.name : 'Error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log as separate string messages to avoid Next.js source map inspection issues
    console.error('[Agent Error]', errorName + ':', errorMessage);
    if (errorStack) {
      console.error('[Agent Error Stack]', errorStack);
    }
    
    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}
