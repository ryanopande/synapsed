import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generatePathwayForStudent } from "@/lib/pathways/generatePathway";
import { getOrBuildTopicMap, NoCourseMaterialError } from "@/lib/course/topicMap";
import { isStudyServiceRequest, requireClassProfessor } from "@/lib/auth";

// POST /api/learning-paths/generate - Generate learning paths
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, surveyId, mode, studentIds } = body;

    // Validate inputs
    if (!classId || !surveyId || !mode) {
      return NextResponse.json(
        { error: "classId, surveyId, and mode are required" },
        { status: 400 }
      );
    }

    if (!['individual', 'selected', 'all'].includes(mode)) {
      return NextResponse.json(
        { error: "mode must be 'individual', 'selected', or 'all'" },
        { status: 400 }
      );
    }

    if (mode === 'individual' && (!studentIds || studentIds.length !== 1)) {
      return NextResponse.json(
        { error: "mode 'individual' requires exactly one studentId" },
        { status: 400 }
      );
    }

    if (mode === 'selected' && (!studentIds || studentIds.length === 0)) {
      return NextResponse.json(
        { error: "mode 'selected' requires at least one studentId" },
        { status: 400 }
      );
    }

    if (!isStudyServiceRequest(req)) {
      const authResult = await requireClassProfessor(classId);
      if (!authResult.ok) return authResult.response;
    }

    // Get survey with responses
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        responses: {
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!survey || survey.classId !== classId) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Build the topic map once up front so every student is planned against the same course outline
    await getOrBuildTopicMap(classId);

    // Determine which students to generate paths for
    let targetResponses = survey.responses;

    if (mode === 'individual' || mode === 'selected') {
      targetResponses = targetResponses.filter((r) =>
        studentIds.includes(r.studentId)
      );
    }

    // Generate paths for each target student
    const results = [];
    const errors = [];

    for (const response of targetResponses) {
      try {
        const pathway = await generatePathwayForStudent({
          classId,
          studentId: response.studentId,
          surveyId,
        });
        results.push({
          studentId: response.studentId,
          studentName: response.student.name || response.student.email,
          pathwayId: pathway.id,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to generate pathway for student ${response.studentId}:`, error);
        errors.push({
          studentId: response.studentId,
          studentName: response.student.name || response.student.email,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      total: targetResponses.length,
      generated: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error) {
    if (error instanceof NoCourseMaterialError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[GENERATE_LEARNING_PATHS]", error);
    return NextResponse.json(
      { error: "Failed to generate learning paths" },
      { status: 500 }
    );
  }
}
