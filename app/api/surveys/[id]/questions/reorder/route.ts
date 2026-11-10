import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/surveys/[id]/questions/reorder - Reorder questions
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const surveyId = params.id;
    const body = await req.json();
    const { questionIds } = body; // Array of question IDs in new order

    if (!surveyId || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { error: "Survey ID and questionIds array are required" },
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

    // Validate that all question IDs exist
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    for (const id of questionIds) {
      if (!questionMap.has(id)) {
        return NextResponse.json(
          { error: `Question with ID ${id} not found` },
          { status: 400 }
        );
      }
    }

    // Reorder questions based on the provided order
    const reorderedQuestions = questionIds.map((id, index) => {
      const question = questionMap.get(id)!;
      return {
        ...question,
        order: index + 1,
      };
    });

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
    });
  } catch (error) {
    console.error("[REORDER_QUESTIONS]", error);
    return NextResponse.json(
      { error: "Failed to reorder questions" },
      { status: 500 }
    );
  }
}

