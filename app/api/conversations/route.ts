import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/agent/conversation-service';

// Get all conversations for a user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

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
    const { threadId, userId, classId, lessonId, title } = await req.json();

    if (!threadId || !userId) {
      return NextResponse.json({ error: 'Thread ID and User ID are required' }, { status: 400 });
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
