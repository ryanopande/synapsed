import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generatePathwayForStudent } from "@/lib/pathways/generatePathway";
import { NoCourseMaterialError } from "@/lib/course/topicMap";
import { isStudyServiceRequest, requireClassProfessor } from "@/lib/auth";

// POST /api/learning-paths/[id]/regenerate - Regenerate a learning path
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pathwayId } = await context.params;
    const { focusArea } = await req.json(); // Optional focus area from professor notes

    if (!pathwayId) {
      return NextResponse.json({ error: "Pathway ID is required" }, { status: 400 });
    }

    const existing = await prisma.learningPathway.findUnique({ where: { id: pathwayId } });
    if (!existing) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }
    if (!isStudyServiceRequest(req)) {
      const authResult = await requireClassProfessor(existing.classId);
      if (!authResult.ok) return authResult.response;
    }
    if (!existing.surveyId) {
      return NextResponse.json({ error: "Pathway has no survey to regenerate from" }, { status: 400 });
    }

    const pathway = await generatePathwayForStudent({
      classId: existing.classId,
      studentId: existing.studentId,
      surveyId: existing.surveyId,
      focusArea,
      existingPathwayId: pathwayId,
    });

    return NextResponse.json({
      success: true,
      pathway,
      message: "Pathway regenerated successfully",
    });
  } catch (error) {
    if (error instanceof NoCourseMaterialError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[REGENERATE_PATHWAY]", error);
    return NextResponse.json({ error: "Failed to regenerate pathway" }, { status: 500 });
  }
}
