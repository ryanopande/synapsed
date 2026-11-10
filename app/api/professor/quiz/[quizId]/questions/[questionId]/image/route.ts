import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { uploadQuizImageToR2 } from '@/lib/r2/uploadQuizImage';

function bufferFromFile(file: File): Promise<Buffer> {
  return new Response(file.stream()).arrayBuffer().then(buf => Buffer.from(buf));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId, questionId } = await params;

    // Verify quiz exists and professor owns it
    const quiz = await prisma.professorQuiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        classId: true,
        professorId: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.professorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify question belongs to quiz
    const question = await prisma.professorQuizQuestion.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        quizId: true,
      },
    });

    if (!question || question.quizId !== quizId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Convert file to buffer and upload to R2
    const buffer = await bufferFromFile(file);
    const imageUrl = await uploadQuizImageToR2(
      buffer,
      file.name,
      file.type,
      quiz.classId,
      quizId
    );

    // Update question with image URL
    const updatedQuestion = await prisma.professorQuizQuestion.update({
      where: { id: questionId },
      data: { imageUrl },
    });

    return NextResponse.json({ 
      success: true,
      imageUrl,
      question: updatedQuestion,
    });
  } catch (error) {
    console.error('Error uploading question image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
    return NextResponse.json(
      { 
        error: 'Failed to upload image',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

