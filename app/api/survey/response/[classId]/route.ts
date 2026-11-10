import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type SurveyAnswer = { questionId: string; answer: string };
type SurveyQuestion = { id: string; text: string; [key: string]: unknown };

export async function GET(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const { searchParams } = new URL(req.url);
  const surveyId = searchParams.get('surveyId');

  try {
    // Build where clause based on surveyId parameter
    const whereClause: { classId: string; surveyId?: string } = { classId };
    if (surveyId) {
      whereClause.surveyId = surveyId;
    }

    const responses = await prisma.studentSurveyResponse.findMany({
      where: whereClause,
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        survey: {
          select: { id: true, questions: true },
        },
      },
    });

    return NextResponse.json(
      responses.map((res) => ({
        studentId: res.studentId,
        surveyId: res.surveyId,
        name: res.student.name || res.student.email,
        submittedAt: res.submittedAt,
        answers: Array.isArray(res.answers)
          ? (res.answers as SurveyAnswer[]).map((ans) => {
              const question = Array.isArray(res.survey?.questions)
                ? (res.survey.questions as SurveyQuestion[]).find((q) => q.questionId == ans.questionId || q.id == ans.questionId)
                : undefined;
              return {
                question: question?.text || "Unknown question",
                answer: ans.answer,
              };
            })
          : [],
      }))
    );
  } catch (error) {
    console.error("[GET_SURVEY_RESPONSES]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}