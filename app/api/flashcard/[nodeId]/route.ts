import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface FlashcardData {
  question: string;
  answer: string;
  hint?: string;
  tags?: string[];
  type?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const deck = await prisma.flashcardDeck.findUnique({
      where: { nodeId },
      include: { cards: { orderBy: { order: 'asc' } } }
    });
    
    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }
    
    return NextResponse.json(deck);
  } catch (error) {
    console.error('Failed to fetch deck:', String(error));
    return NextResponse.json({ error: 'Failed to fetch deck' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const { cards } = await request.json();
    
    const deck = await prisma.flashcardDeck.update({
      where: { nodeId },
      data: {
        cards: {
          deleteMany: {},
          create: cards.map((card: FlashcardData, index: number) => ({
            question: card.question,
            answer: card.answer,
            hint: card.hint || null,
            tags: card.tags || [],
            type: card.type || 'concept',
            order: index + 1
          }))
        }
      },
      include: { cards: { orderBy: { order: 'asc' } } }
    });
    
    return NextResponse.json(deck);
  } catch (error) {
    console.error('Failed to update deck:', String(error));
    return NextResponse.json({ error: 'Failed to update deck' }, { status: 500 });
  }
} 