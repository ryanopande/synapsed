import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadToMistral } from '@/lib/rag/UploadToMistral';
import { getOcrMarkdown } from '@/lib/rag/ragGetMarkdown';
import { GoogleGenAI } from '@google/genai';
import { Type } from '@google/genai';
import { OCRQuestion, OCRResponse } from '@/lib/types/quizzes';
import { GEMINI_MODEL } from '@/lib/gemini-model';

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and images are supported.' },
        { status: 400 }
      );
    }

    // Step 1: Upload to Mistral for OCR processing
    const uploadRes = await uploadToMistral(file);
    const ocrPages = await getOcrMarkdown(uploadRes.id);

    // Step 2: Combine all pages into single text
    const fullText = ocrPages
      .map((page) => `--- Page ${page.page} ---\n${page.markdown}`)
      .join('\n\n');

    // Step 3: Use AI to parse questions from OCR text
    const extractQuestionsFunction = {
      name: "extractQuizQuestions",
      description: "Extract quiz questions and answers from OCR text",
      parameters: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: "The question text"
                },
                type: {
                  type: Type.STRING,
                  enum: ["multiple-choice", "short-answer", "true-false"],
                  description: "Type of question"
                },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: "Option text"
                      },
                      isCorrect: {
                        type: Type.BOOLEAN,
                        description: "Whether this option is correct"
                      }
                    }
                  },
                  description: "Answer options (required for multiple-choice and true-false)"
                }
              },
              required: ["text", "type"]
            },
            description: "List of extracted questions"
          }
        },
        required: ["questions"]
      }
    };

    const aiResponse = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Extract all quiz questions from this OCR text. Identify question types (multiple-choice, short-answer, true-false) and extract answer options with correct answers marked.

OCR Text:
${fullText}

Extract all questions with their answers. For multiple-choice questions, identify which option is correct. For true/false questions, mark the correct answer. For short-answer questions, include empty options array.`,
      config: {
        tools: [{
          functionDeclarations: [extractQuestionsFunction]
        }]
      }
    });

    // Parse AI response
    let questions: OCRQuestion[] = [];
    
    if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
      const functionCall = aiResponse.functionCalls[0];
      if (functionCall.name === 'extractQuizQuestions') {
        const extracted = functionCall.args as { questions?: OCRQuestion[] };
        questions = Array.isArray(extracted?.questions) ? extracted.questions : [];
      }
    }

    // If function calling failed, try fallback parsing
    if (questions.length === 0) {
      // Fallback: simple text parsing
      questions = await fallbackQuestionParsing(fullText);
    }

    // Transform to match frontend Question type format
    const transformedQuestions = questions.map((q, index) => ({
      id: `ocr-${Date.now()}-${index}`,
      text: q.text || '',
      type: q.type || 'multiple-choice',
      options: (q.options || []).map((opt, optIndex: number) => ({
        id: `ocr-${Date.now()}-${index}-${optIndex}`,
        text: opt.text || '',
        isCorrect: opt.isCorrect || false,
      })),
      order: index + 1,
    }));

    const response: OCRResponse = {
      success: true,
      questions: transformedQuestions,
      pagesProcessed: ocrPages.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing OCR:', error);
    return NextResponse.json(
      { error: 'Failed to process OCR' },
      { status: 500 }
    );
  }
}

// Fallback parsing method
async function fallbackQuestionParsing(text: string): Promise<OCRQuestion[]> {
  // Simple regex-based parsing as fallback
  const questions: OCRQuestion[] = [];
  
  // Split by common question patterns
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  let currentQuestion: OCRQuestion | null = null;
  
  for (const line of lines) {
    // Check if line looks like a question
    if (line.match(/^\d+[\.\)]\s+[A-Z]/) || line.match(/^[A-Z][^a-z]*\?/)) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        text: line.replace(/^\d+[\.\)]\s*/, '').trim(),
        type: 'multiple-choice',
        options: [],
      };
    } else if (currentQuestion && line.match(/^[a-eA-E][\.\)]\s+/)) {
      // Option line
      const optionText = line.replace(/^[a-eA-E][\.\)]\s+/, '').trim();
      const isCorrect = line.includes('*') || line.includes('✓') || line.includes('correct');
      if (!currentQuestion.options) {
        currentQuestion.options = [];
      }
      currentQuestion.options.push({
        text: optionText.replace(/[*✓]/g, '').trim(),
        isCorrect,
      });
    } else if (currentQuestion && line.trim().length > 0) {
      // Continue question text
      currentQuestion.text += ' ' + line.trim();
    }
  }
  
  if (currentQuestion) {
    questions.push(currentQuestion);
  }
  
  return questions;
}

