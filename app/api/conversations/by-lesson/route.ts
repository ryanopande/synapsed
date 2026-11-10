import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/agent/conversationService';
import { requireUser } from '@/lib/auth';

/**
 * GET /api/conversations/by-lesson
 * Retrieves the signed-in user's conversation for a class and lesson
 * Query params: classId (optional), lessonId (optional). A userId param is ignored.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const userId = authResult.user.id;

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId') || undefined;
    const lessonId = searchParams.get('lessonId') || undefined;

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

