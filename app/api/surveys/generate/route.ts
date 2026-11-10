import { NextRequest, NextResponse } from "next/server";
import { getSyllabusContext, getClassInfo } from "@/lib/surveys/syllabusService";
import { generateDiagnosticSurvey } from "@/lib/surveys/diagnostic";
import { NoCourseMaterialError } from "@/lib/course/topicMap";
import { prisma } from "@/lib/db/prisma";
import { requireClassProfessor } from "@/lib/auth";

// POST /api/surveys/generate - AI generation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId } = body;

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    const authResult = await requireClassProfessor(classId);
    if (!authResult.ok) return authResult.response;

    // Get class information and syllabus context
    const classInfo = await getClassInfo(classId);
    if (!classInfo) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const syllabusContext = await getSyllabusContext(classId);

    // Knowledge questions come from the class's own topic map (syllabus + uploaded content)
    const { questions } = await generateDiagnosticSurvey(classId, classInfo.title);

    // Create draft survey
    const survey = await prisma.survey.create({
      data: {
        classId,
        title: `${classInfo.title} - Survey`,
        questions,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({
      success: true,
      survey,
      metadata: {
        courseName: syllabusContext.courseName,
        courseDescription: syllabusContext.courseDescription,
        hasSyllabus: syllabusContext.hasSyllabus,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof NoCourseMaterialError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[SURVEY_GENERATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate survey" },
      { status: 500 }
    );
  }
}
