import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/surveys/[id]/publish - Publish a draft survey
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const surveyId = params.id;
    
    // Get optional body parameter to force publish (auto-archive existing)
    const body = await req.json().catch(() => ({}));
    const { forcePublish = false } = body;

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

    if (survey.status !== 'DRAFT') {
      return NextResponse.json(
        { error: "Only draft surveys can be published" },
        { status: 400 }
      );
    }

    // Validate that survey has questions
    const questions = survey.questions as unknown[];
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "Cannot publish survey without questions" },
        { status: 400 }
      );
    }

    // Check if there's already an active survey for this class
    const existingActiveSurvey = await prisma.survey.findFirst({
      where: {
        classId: survey.classId,
        status: 'ACTIVE',
        id: { not: surveyId }, // Exclude current survey
      },
    });

    if (existingActiveSurvey && !forcePublish) {
      // Return conflict with information about the existing survey
      return NextResponse.json(
        {
          error: "CONFLICT",
          message: "Another survey is already active for this class",
          existingSurvey: {
            id: existingActiveSurvey.id,
            title: existingActiveSurvey.title,
            publishedAt: existingActiveSurvey.publishedAt,
          },
          requiresConfirmation: true,
        },
        { status: 409 }
      );
    }

    // If forcePublish is true, archive the existing active survey
    if (existingActiveSurvey && forcePublish) {
      await prisma.survey.update({
        where: { id: existingActiveSurvey.id },
        data: { status: 'ARCHIVED' },
      });
    }

    // Publish the survey
    const publishedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      survey: publishedSurvey,
      message: "Survey published successfully",
      archivedPrevious: !!existingActiveSurvey,
    });
  } catch (error) {
    console.error("[PUBLISH_SURVEY]", error);
    return NextResponse.json(
      { error: "Failed to publish survey" },
      { status: 500 }
    );
  }
}

