import { NextRequest, NextResponse } from "next/server";
import { invokeAgent } from "@/lib/agent/simple-agent";
import { ConversationService } from "@/lib/agent/conversation-service";
import {
  getCachedVoiceTurn,
  pruneExpiredVoiceTurns,
  setCachedVoiceTurn,
} from "@/lib/agent/voice-turn-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, userId, classId, lessonId, threadId, turnId } = body as {
      transcript?: string;
      userId?: string;
      classId?: string;
      lessonId?: string;
      threadId?: string;
      turnId?: string;
    };

    const userMessage = transcript?.trim();
    if (!userMessage) {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 }
      );
    }
    if (!turnId) {
      return NextResponse.json({ error: "turnId is required" }, { status: 400 });
    }

    pruneExpiredVoiceTurns();

    let conversation;
    if (userId) {
      conversation = await ConversationService.getOrCreateConversation({
        userId,
        classId,
        lessonId,
        threadId,
      });
    }

    const agentThreadId =
      conversation?.threadId || threadId || `voice-thread-${Date.now()}`;
    const cacheScope = conversation?.id || agentThreadId;

    const cached = getCachedVoiceTurn(cacheScope, turnId);
    if (cached) {
      return NextResponse.json(cached);
    }

    const agentResponse = await invokeAgent(
      userMessage,
      agentThreadId,
      classId,
      userId,
      conversation?.id
    );

    if (conversation) {
      try {
        await ConversationService.saveMessage({
          conversationId: conversation.id,
          role: "USER",
          content: userMessage,
        });
        await ConversationService.saveMessage({
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: agentResponse.content,
          sources: agentResponse.sources,
        });
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : "Unknown save error";
        console.error("[Voice Turn Save Error]", message);
      }
    }

    const payload = {
      userText: userMessage,
      assistantText: agentResponse.content,
      diagramData: agentResponse.diagramData,
      sources: agentResponse.sources,
      inChatAssessmentData: agentResponse.inChatAssessmentData,
      threadId: agentThreadId,
      conversationId: conversation?.id,
    };

    setCachedVoiceTurn(cacheScope, turnId, payload);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process voice turn";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
