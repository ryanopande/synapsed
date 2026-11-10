// using Gemini cause it is cheaper and still really good. 
import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODEL, gemini } from '@/lib/ai/gemini';
import { requireUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Gemini `Content` roles must be `user` | `model` (not `assistant`).
    const formattedMessages = messages.map((msg: { role: string; content: string }) => {
      const role =
        msg.role === "assistant" ? "model" : msg.role === "model" ? "model" : "user";
      return {
        role,
        parts: [{ text: msg.content }],
      };
    });

   

    const result = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: formattedMessages,
    });

    const text = result.text;

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
