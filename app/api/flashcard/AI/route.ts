import { NextRequest, NextResponse } from 'next/server';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GEMINI_MODEL } from "@/lib/gemini-model";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeTitle, markdownContent } = body;

    if (!nodeTitle || !markdownContent) {
      return NextResponse.json(
        { error: 'nodeTitle and markdownContent are required' },
        { status: 400 }
      );
    }

    const prompt = `You are an expert educational content creator specializing in creating engaging flashcards for students. 

Create 15-20 high-quality flashcards based on the following lesson content. The flashcards should be diverse, engaging, and cover different aspects of the material.

Lesson Title: ${nodeTitle}
Lesson Content:
${markdownContent}

Requirements:
1. Create 15-20 flashcards total
2. Mix of concept cards (60%) and quiz-style cards (40%)
3. Each card should have:
   - A clear, specific question
   - A comprehensive but concise answer
   - A helpful hint (optional but encouraged)
   - Relevant tags
   - Type: either "concept" or "quiz"

4. Concept cards should focus on:
   - Key definitions and terms
   - Important principles and concepts
   - Core ideas and theories
   - Fundamental relationships

5. Quiz cards should focus on:
   - Application scenarios
   - Problem-solving situations
   - Comparative analysis
   - Practical implications

6. Questions should be:
   - Specific and focused
   - Engaging and thought-provoking
   - Appropriate for college-level students
   - Varied in difficulty

7. Answers should be:
   - Accurate and comprehensive
   - Clear and well-structured
   - Educational and informative
   - 2-4 sentences maximum

Respond ONLY with valid JSON in this exact format (no markdown formatting, no code blocks):
[
  {
    "question": "Specific question about the content",
    "answer": "Clear, comprehensive answer",
    "hint": "Optional helpful hint",
    "tags": ["relevant", "tags"],
    "type": "concept"
  }
]`;

    const model = new ChatGoogleGenerativeAI({
      model: GEMINI_MODEL,
      maxOutputTokens: 4000,
      temperature: 0.7,
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await model.invoke([
      { role: "human", content: prompt }
    ]);

    const aiResponse = response.content as string;
    
    // Clean the response to remove any markdown formatting
    let cleanResponse = aiResponse.trim();
    
    // Remove markdown code blocks if present
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    // Validate JSON
    try {
      JSON.parse(cleanResponse);
      return NextResponse.json({ content: cleanResponse });
    } catch {
      console.error('AI response is not valid JSON:', cleanResponse);
      return NextResponse.json(
        { error: 'Invalid AI response format', details: 'Response is not valid JSON' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Flashcard AI API error:', error);
    return NextResponse.json(
      { error: 'AI request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
