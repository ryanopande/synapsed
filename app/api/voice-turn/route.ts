import { NextRequest, NextResponse } from "next/server";
import { invokeAgent } from "@/lib/agent/tutorAgent";
import { ConversationService } from "@/lib/agent/conversationService";
import {
  getCachedVoiceTurn,
  pruneExpiredVoiceTurns,
  setCachedVoiceTurn,
} from "@/lib/agent/voiceTurnStore";
import { requireClassMember, requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    // Conversations always belong to the signed-in user; a userId in the body is ignored.
    const userId = authResult.user.id;

    const body = await request.json();
    const { transcript, classId, lessonId, threadId, turnId } = body as {
      transcript?: string;
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

    if (classId) {
      const memberResult = await requireClassMember(classId);
      if (!memberResult.ok) return memberResult.response;
    }

    pruneExpiredVoiceTurns();

    const conversation = await ConversationService.getOrCreateConversation({
      userId,
      classId,
      lessonId,
      threadId,
    });

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
      conversation?.id,
      lessonId
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
