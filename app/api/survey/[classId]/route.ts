import { prisma } from "@/lib/db/prisma";
import { stripAnswerKeys } from "@/lib/surveys/diagnostic";
import { NextRequest, NextResponse } from "next/server";
import { requireClassMember } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    const params = await context.params;
    const classId = params.classId;

    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    const authResult = await requireClassMember(classId);
    if (!authResult.ok) return authResult.response;

    // Only return ACTIVE surveys to students
    const survey = await prisma.survey.findFirst({
      where: { 
        classId,
        status: 'ACTIVE'
      },
    });

    if (!survey) {
      return NextResponse.json({ 
        questions: [],
        message: "No active survey available" 
      }, { status: 200 });
    }

    const questions = Array.isArray(survey.questions) ? stripAnswerKeys(survey.questions as { correctAnswer?: unknown }[]) : [];
    return NextResponse.json({ questions });
  } catch (error) {
    console.error("[GET_SURVEY]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}