import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { computeMastery } from "@/lib/course/mastery";
import type { CourseTopic } from "@/lib/course/types";
import { requireEnrolledStudent, requireStudentOrClassProfessor } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { classId, surveyId, answers } = await req.json();

    if (!classId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Students submit their own answers; a studentId in the body is ignored.
    const authResult = await requireEnrolledStudent(classId);
    if (!authResult.ok) return authResult.response;
    const studentId = authResult.user.id;

    // If surveyId not provided, find the active survey for this class
    let activeSurveyId = surveyId;
    if (!activeSurveyId) {
      const activeSurvey = await prisma.survey.findFirst({
        where: { 
          classId,
          status: 'ACTIVE'
        }
      });

      if (!activeSurvey) {
        return NextResponse.json({ 
          error: "No active survey available for this class" 
        }, { status: 404 });
      }

      activeSurveyId = activeSurvey.id;
    }

    // Verify the survey is active
    const survey = await prisma.survey.findUnique({
      where: { id: activeSurveyId }
    });

    if (!survey || survey.classId !== classId || survey.status !== 'ACTIVE') {
      return NextResponse.json({ 
        error: "This survey is not currently active" 
      }, { status: 400 });
    }

    // Ensure answers is properly formatted for JSON storage
    const formattedAnswers = answers.map((answer: { questionId?: string; question_id?: string; answer?: string; value?: string; text?: string }) => ({
      questionId: answer.questionId || answer.question_id,
      answer: answer.answer || answer.value || answer.text
    }));

    // Check for existing response for this student and survey
    const existing = await prisma.studentSurveyResponse.findFirst({
      where: { 
        studentId, 
        surveyId: activeSurveyId 
      },
    });

    if (existing) {
      // Update the existing response
      await prisma.studentSurveyResponse.update({
        where: { id: existing.id },
        data: {
          answers: formattedAnswers,
          submittedAt: new Date(),
        },
      });
    } else {
      // Create new survey response
      await prisma.studentSurveyResponse.create({
        data: {
          studentId,
          surveyId: activeSurveyId,
          classId,
          answers: formattedAnswers,
          submittedAt: new Date(),
        },
      });
    }

    // Best-effort mastery snapshot; pathway generation recomputes it if this is skipped.
    try {
      const cls = await prisma.class.findUnique({ where: { id: classId }, select: { topicMap: true } });
      const topics = Array.isArray(cls?.topicMap) ? (cls!.topicMap as unknown as CourseTopic[]) : [];
      const questions = Array.isArray(survey.questions) ? survey.questions : [];
      if (topics.length > 0) {
        await prisma.studentSurveyResponse.updateMany({
          where: { studentId, surveyId: activeSurveyId },
          data: {
            mastery: computeMastery(
              questions as Parameters<typeof computeMastery>[0],
              formattedAnswers as Parameters<typeof computeMastery>[1],
              topics
            ) as unknown as object,
          },
        });
      }
    } catch (error) {
      console.error("[SURVEY_SUBMIT_MASTERY]", error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SURVEY_SUBMIT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



// ✅ Handle GET for checking if student submitted
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const surveyId = searchParams.get("surveyId");
  
    if (!studentId || !classId) {
      return NextResponse.json({ error: "Missing studentId or classId" }, { status: 400 });
    }

    const authResult = await requireStudentOrClassProfessor(classId, studentId);
    if (!authResult.ok) return authResult.response;

    // If surveyId not provided, find the active survey
    let activeSurveyId = surveyId;
    if (!activeSurveyId) {
      const activeSurvey = await prisma.survey.findFirst({
        where: { 
          classId,
          status: 'ACTIVE'
        }
      });

      if (!activeSurvey) {
        return NextResponse.json({ submitted: false, noActiveSurvey: true });
      }

      activeSurveyId = activeSurvey.id;
    }
  
    const existing = await prisma.studentSurveyResponse.findFirst({
      where: { 
        studentId, 
        surveyId: activeSurveyId 
      },
    });
  
    return NextResponse.json({ submitted: !!existing, surveyId: activeSurveyId });
  }