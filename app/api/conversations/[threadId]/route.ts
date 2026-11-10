import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/agent/conversationService';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth';

/** The signed-in user's conversation with this threadId, or an error response. */
async function getOwnConversation(threadId: string) {
  const authResult = await requireUser();
  if (!authResult.ok) return { response: authResult.response };

  const conversation = await ConversationService.getConversationByThreadId(threadId);
  // Report another user's thread as missing rather than revealing that it exists.
  if (!conversation || conversation.userId !== authResult.user.id) {
    return { response: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }) };
  }
  return { conversation };
}

// Get a specific conversation by thread ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    const { conversation, response } = await getOwnConversation(threadId);
    if (response) return response;

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error getting conversation:', error);
    return NextResponse.json({ 
      error: 'Failed to get conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Update conversation title
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const { title } = await req.json();

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { conversation: existing, response } = await getOwnConversation(threadId);
    if (response) return response;

    const conversation = await ConversationService.saveConversation({
      threadId,
      userId: existing.userId,
      classId: existing.classId || undefined,
      lessonId: existing.lessonId || undefined,
      title,
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ 
      error: 'Failed to update conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Delete a conversation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    const { response } = await getOwnConversation(threadId);
    if (response) return response;

    await prisma.conversation.delete({
      where: { threadId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ 
      error: 'Failed to delete conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
