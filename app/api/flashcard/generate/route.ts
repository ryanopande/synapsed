import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGemini } from '@/lib/flashcard/generate';

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
    
    //console.log('Starting flashcard generation for nodeId:', nodeId);
    
    // Check if PathwayNode exists, if not create a temporary one for testing
    let pathwayNode = await prisma.pathwayNode.findUnique({
      where: { id: nodeId }
    });
    
    if (!pathwayNode) {
      // Create a temporary pathway and node for testing
      const tempPathway = await prisma.learningPathway.create({
        data: {
          studentId: '507f1f77bcf86cd799439012', // Use a proper ObjectID
          classId: '507f1f77bcf86cd799439013',   // Use a proper ObjectID
          status: 'pending'
        }
      });
      
      pathwayNode = await prisma.pathwayNode.create({
        data: {
          id: nodeId,
          pathwayId: tempPathway.id,
          nodeId: nodeId,
          title: nodeTitle || 'Test Node',
          description: markdownContent || 'Test content',
          type: 'topic',
          difficulty: 'beginner',
          duration: '30 minutes',
          dependsOn: []
        }
      });
    }
    
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