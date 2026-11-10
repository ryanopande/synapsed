// /api/survey/save/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const SurveySchema = z.object({
  classId: z.string(),
  questions: z.array(
    z.object({
      questionId: z.string(),
      text: z.string(),
      type: z.union([z.literal("short-answer"), z.literal("multiple-choice")]),
      options: z.array(z.string()).optional(),
    })
  ),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // console.log('🔍 Survey save request body:', {
    //   classId: body.classId,
    //   questionsCount: body.questions?.length,
    //   questionsSample: body.questions?.slice(0, 2),
    //   firstQuestionKeys: body.questions?.[0] ? Object.keys(body.questions[0]) : []
    // });
    
    const parseResult = SurveySchema.safeParse(body);
    if (!parseResult.success) {
      console.error('❌ Schema validation failed:', parseResult.error);
      return NextResponse.json({ success: false, error: "Invalid input", details: parseResult.error }, { status: 400 });
    }
    const { classId, questions } = parseResult.data;

    if (!classId || !questions) {
      return NextResponse.json({ success: false, error: "Missing classId or questions" }, { status: 400 });
    }

    // Find existing survey for this class
    const existingSurvey = await prisma.survey.findFirst({
      where: { classId },
      orderBy: { createdAt: 'desc' }
    });

    const survey = existingSurvey
      ? await prisma.survey.update({
          where: { id: existingSurvey.id },
          data: { questions }
        })
      : await prisma.survey.create({
          data: { classId, questions, title: "Survey" }
        });

    return NextResponse.json({ success: true, survey });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}