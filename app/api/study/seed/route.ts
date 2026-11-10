import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

type ProfileInput = {
  id: string;
  description?: string;
  answers: Record<string, string>;
};

type SurveyQuestion = {
  id: string;
  text: string;
  type: string;
  options?: string[];
  required: boolean;
  order: number;
};

const STANDARD_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "goals_1",
    text: "What are your primary learning goals for this course?",
    type: "short-answer",
    required: true,
    order: 0,
  },
  {
    id: "goals_2",
    text: "What motivated you to enroll in this course?",
    type: "multiple-choice",
    options: [
      "Required for my major",
      "Personal interest in the subject",
      "Career advancement",
      "Prerequisite for other courses",
      "Other",
    ],
    required: true,
    order: 1,
  },
  {
    id: "prereq_1",
    text: "Rate your current understanding of prerequisite topics for this course",
    type: "multiple-choice",
    options: [
      "Very confident",
      "Somewhat confident",
      "Neutral",
      "Somewhat uncertain",
      "Very uncertain",
    ],
    required: true,
    order: 2,
  },
  {
    id: "learning_1",
    text: "What is your preferred learning style?",
    type: "multiple-choice",
    options: [
      "Visual (diagrams, charts, videos)",
      "Auditory (lectures, discussions)",
      "Reading/Writing (texts, notes)",
      "Kinesthetic (hands-on activities)",
      "Mixed approach",
    ],
    required: true,
    order: 3,
  },
  {
    id: "bloom_remember",
    text: "List key concepts you remember from previous related courses",
    type: "short-answer",
    required: true,
    order: 4,
  },
  {
    id: "bloom_understand",
    text: "What do you expect to learn in this course?",
    type: "short-answer",
    required: true,
    order: 5,
  },
  {
    id: "bloom_apply",
    text: "How do you plan to apply what you learn in this course?",
    type: "short-answer",
    required: true,
    order: 6,
  },
  {
    id: "bloom_analyze",
    text: "What challenges do you anticipate in this course?",
    type: "short-answer",
    required: true,
    order: 7,
  },
];

function verifyApiKey(req: NextRequest, bodyKey?: string): boolean {
  const expected = process.env.STUDY_API_KEY;
  if (!expected) return false;
  const headerKey = req.headers.get("x-study-api-key");
  return headerKey === expected || bodyKey === expected;
}

function answersToJson(answers: Record<string, string>) {
  return Object.entries(answers).map(([questionId, answer]) => ({
    questionId,
    answer,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      apiKey,
      classId: existingClassId,
      professorId,
      classTitle = "Study — AI Literacy Validation",
      classDescription = "Synthetic validation class for personalized pathway study",
      profiles,
      reset = true,
    } = body as {
      apiKey?: string;
      classId?: string;
      professorId?: string;
      classTitle?: string;
      classDescription?: string;
      profiles: ProfileInput[];
      reset?: boolean;
    };

    if (!verifyApiKey(req, apiKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!profiles?.length) {
      return NextResponse.json({ error: "profiles array is required" }, { status: 400 });
    }

    let classId = existingClassId as string | undefined;

    if (!classId) {
      if (!professorId) {
        return NextResponse.json(
          { error: "classId or professorId is required" },
          { status: 400 }
        );
      }
      const newClass = await prisma.class.create({
        data: {
          title: classTitle,
          description: classDescription,
          professorId,
          joinToken: nanoid(10),
        },
      });
      classId = newClass.id;
    }

    if (reset) {
      await prisma.learningPathway.deleteMany({ where: { classId } });
      await prisma.studentSurveyResponse.deleteMany({ where: { classId } });
      await prisma.survey.updateMany({
        where: { classId, status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      });
    }

    const survey = await prisma.survey.create({
      data: {
        classId,
        title: "Study Synthetic Validation Survey",
        status: "ACTIVE",
        questions: STANDARD_SURVEY_QUESTIONS,
        publishedAt: new Date(),
      },
    });

    const students: Array<{
      profileId: string;
      studentId: string;
      email: string;
      description?: string;
    }> = [];

    for (const profile of profiles) {
      const email = `study-${profile.id}@synapsed.study.local`;

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: `Study ${profile.id}`,
            role: "STUDENT",
          },
        });
      }

      await prisma.classEnrollment.upsert({
        where: {
          studentId_classId: { studentId: user.id, classId },
        },
        create: { studentId: user.id, classId },
        update: {},
      });

      await prisma.studentSurveyResponse.upsert({
        where: {
          studentId_surveyId: { studentId: user.id, surveyId: survey.id },
        },
        create: {
          studentId: user.id,
          surveyId: survey.id,
          classId,
          answers: answersToJson(profile.answers),
        },
        update: {
          answers: answersToJson(profile.answers),
          submittedAt: new Date(),
        },
      });

      students.push({
        profileId: profile.id,
        studentId: user.id,
        email,
        description: profile.description,
      });
    }

    return NextResponse.json({
      success: true,
      classId,
      surveyId: survey.id,
      students,
    });
  } catch (error) {
    console.error("[STUDY_SEED]", error);
    return NextResponse.json({ error: "Failed to seed study data" }, { status: 500 });
  }
}
