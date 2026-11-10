import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/agent/conversationService';
import { requireUser } from '@/lib/auth';

// Conversations always belong to the signed-in user; any userId sent by the client is ignored.

// Get all conversations for the signed-in user
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const userId = authResult.user.id;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const conversations = await ConversationService.getUserConversations(userId, limit);

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error getting conversations:', error);
    return NextResponse.json({ 
      error: 'Failed to get conversations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const userId = authResult.user.id;

    const { threadId, classId, lessonId, title } = await req.json();

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    const existing = await ConversationService.getConversationByThreadId(threadId);
    if (existing && existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const conversation = await ConversationService.saveConversation({
      threadId,
      userId,
      classId,
      lessonId,
      title,
      messages: []
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ 
      error: 'Failed to create conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
