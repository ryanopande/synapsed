import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { requestAiFlashcards } from '@/lib/flashcards/generate';

// POST { nodeTitle, markdownContent }: raw AI flashcards for a lesson, as a JSON string in `content`
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;

    const { nodeTitle, markdownContent } = await request.json();

    if (!nodeTitle || !markdownContent) {
      return NextResponse.json(
        { error: 'nodeTitle and markdownContent are required' },
        { status: 400 }
      );
    }

    try {
      const content = await requestAiFlashcards(nodeTitle, markdownContent);
      return NextResponse.json({ content });
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('AI response is not valid JSON');
        return NextResponse.json(
          { error: 'Invalid AI response format', details: 'Response is not valid JSON' },
          { status: 500 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Flashcard AI API error:', error);
    return NextResponse.json(
      { error: 'AI request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
