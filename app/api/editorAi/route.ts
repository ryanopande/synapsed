import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI, callClaude, callGemini } from './helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body || !body.prompt) {
      return NextResponse.json(
        { error: 'Missing required prompt parameter' },
        { status: 400 }
      );
    }
    
    const { prompt } = body;
    
    // Choose AI provider based on env or request
    const provider = process.env.NEXT_PUBLIC_AI_PROVIDER || 'openai';
    //console.log('provider', provider, 'action:', action, 'text:', text?.substring(0, 50) + '...', 'contextLength:', fullContext?.length);
    
    let response;
    switch (provider) {
      case 'openai':
        response = await callOpenAI(prompt);
        break;
      case 'claude':
        response = await callClaude(prompt);
        break;
      case 'gemini':
        response = await callGemini(prompt);
        break;
      default:
        response = await callOpenAI(prompt);
    }
    
    return NextResponse.json({ content: response });
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json(
      { error: 'AI request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}