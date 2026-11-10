import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/surveys/[id]/duplicate - Duplicate a survey
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const surveyId = params.id;

    if (!surveyId) {
      return NextResponse.json({ error: "Survey ID is required" }, { status: 400 });
    }

    // Find the original survey
    const originalSurvey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!originalSurvey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Create a duplicate with all questions
    const duplicatedSurvey = await prisma.survey.create({
      data: {
        classId: originalSurvey.classId,
        title: `${originalSurvey.title} (Copy)`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JSON type conversion
        questions: originalSurvey.questions as any, // Copy all questions
        status: 'DRAFT', // Always create as draft
        duplicatedFrom: surveyId,
      },
    });

    return NextResponse.json({
      success: true,
      survey: duplicatedSurvey,
      message: "Survey duplicated successfully",
    });
  } catch (error) {
    console.error("[DUPLICATE_SURVEY]", error);
    return NextResponse.json(
      { error: "Failed to duplicate survey" },
      { status: 500 }
    );
  }
}

