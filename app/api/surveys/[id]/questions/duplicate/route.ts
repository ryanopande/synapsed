import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/surveys/[id]/questions/duplicate - Duplicate a question within a survey
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const surveyId = params.id;
    const body = await req.json();
    const { questionId } = body;

    if (!surveyId || !questionId) {
      return NextResponse.json(
        { error: "Survey ID and Question ID are required" },
        { status: 400 }
      );
    }

    // Find the survey
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status !== 'DRAFT') {
      return NextResponse.json(
        { error: "Only draft surveys can be edited" },
        { status: 400 }
      );
    }

    const questions = survey.questions as {
      id: string;
      text: string;
      type: string;
      options?: string[];
      required: boolean;
      order: number;
      duplicatedFrom?: string;
    }[];

    // Find the question to duplicate
    const questionIndex = questions.findIndex((q) => q.id === questionId);
    if (questionIndex === -1) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const originalQuestion = questions[questionIndex];

    // Create a duplicate question
    const newQuestion = {
      ...originalQuestion,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: `${originalQuestion.text} (Copy)`,
      order: originalQuestion.order + 0.5, // Insert after original
      duplicatedFrom: questionId,
    };

    // Insert the new question after the original
    const updatedQuestions = [
      ...questions.slice(0, questionIndex + 1),
      newQuestion,
      ...questions.slice(questionIndex + 1),
    ];

    // Reorder all questions
    const reorderedQuestions = updatedQuestions.map((q, index) => ({
      ...q,
      order: index + 1,
    }));

    // Update the survey
    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        questions: reorderedQuestions,
      },
    });

    return NextResponse.json({
      success: true,
      survey: updatedSurvey,
      newQuestion,
    });
  } catch (error) {
    console.error("[DUPLICATE_QUESTION]", error);
    return NextResponse.json(
      { error: "Failed to duplicate question" },
      { status: 500 }
    );
  }
}

