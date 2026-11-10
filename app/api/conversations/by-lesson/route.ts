import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/agent/conversation-service';

/**
 * GET /api/conversations/by-lesson
 * Retrieves a conversation by userId, classId, and lessonId
 * Query params: userId, classId (optional), lessonId (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const classId = searchParams.get('classId') || undefined;
    const lessonId = searchParams.get('lessonId') || undefined;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const conversation = await ConversationService.getConversationByLesson(
      userId,
      classId,
      lessonId
    );

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error getting conversation by lesson:', error);
    return NextResponse.json(
      {
        error: 'Failed to get conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

