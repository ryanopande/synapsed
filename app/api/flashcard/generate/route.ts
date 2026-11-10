import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { callGemini } from '@/lib/flashcards/generate';
import { requirePathwayNodeAccess } from '@/lib/auth';

interface FlashcardData {
  question: string;
  answer: string;
  hint?: string;
  tags?: string[];
  type?: string;
}

export async function POST(request: NextRequest) {
  try {
    //console.log('POST request received');
    const body = await request.json();
    //console.log('Request body:', body);
    
    const { nodeId, nodeTitle, markdownContent } = body;
    
    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });
    }
    
    const access = await requirePathwayNodeAccess(nodeId);
    if (!access.ok) return access.response;

    //console.log('About to call Gemini');
    
    // Generate flashcards using Gemini
    const aiResponse = await callGemini(nodeTitle, markdownContent);
    //console.log('Gemini response received:', aiResponse);
    
    // Parse JSON response with error handling
    let cardsData;
    try {
      cardsData = JSON.parse(aiResponse);
      //console.log('Parsed cards data:', cardsData);
    } catch (parseError) {
      console.error('Failed to parse AI response:', String(parseError));
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 });
    }
    
    // Validate cards structure
    if (!Array.isArray(cardsData)) {
      //console.error('Cards data is not an array:', cardsData);
      return NextResponse.json({ error: 'Invalid cards format' }, { status: 500 });
    }
    
    // Save to database
    const deck = await prisma.flashcardDeck.upsert({
      where: { nodeId },
      update: {
        title: nodeTitle,
        lastGenerated: new Date(),
        cards: {
          deleteMany: {},
          create: cardsData.map((card: FlashcardData, index: number) => ({
            question: card.question,
            answer: card.answer,
            hint: card.hint || null,
            tags: card.tags || [],
            type: card.type || 'concept',
            order: index + 1
          }))
        }
      },
      create: {
        nodeId,
        title: nodeTitle,
        cards: {
          create: cardsData.map((card: FlashcardData, index: number) => ({
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
  } catch {
    //console.error('Flashcard generation error:', String(error));
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
} 