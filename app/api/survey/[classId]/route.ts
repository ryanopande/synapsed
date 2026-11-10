// /app/api/survey/[classId]/route.ts

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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

    return NextResponse.json({ questions: survey.questions });
  } catch (error) {
    console.error("[GET_SURVEY]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}