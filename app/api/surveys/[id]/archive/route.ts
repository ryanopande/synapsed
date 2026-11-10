import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/surveys/[id]/archive - Archive a survey
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

    // Find the survey
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status === 'ARCHIVED') {
      return NextResponse.json(
        { error: "Survey is already archived" },
        { status: 400 }
      );
    }

    // Archive the survey
    const archivedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        status: 'ARCHIVED',
      },
    });

    return NextResponse.json({
      success: true,
      survey: archivedSurvey,
      message: "Survey archived successfully",
    });
  } catch (error) {
    console.error("[ARCHIVE_SURVEY]", error);
    return NextResponse.json(
      { error: "Failed to archive survey" },
      { status: 500 }
    );
  }
}

