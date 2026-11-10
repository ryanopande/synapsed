import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL } from "@/lib/gemini-model";
import {
  buildPathwayPrompt,
  getPathwayFunctionDeclaration,
  PATHWAY_BLOCK_IDS,
} from "@/lib/learning-paths/pathwayPrompt";

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type SurveyAnswer = { questionId: string; answer: string };
type SurveyQuestion = { id: string; text: string };

type PathwayNodeInput = {
  id: string;
  title: string;
  description: string;
  syllabusBlockId?: string;
  type: string;
  difficulty: string;
  duration: string;
  dependsOn: string[];
};

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

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Get syllabus content
    const syllabusContext = await getSyllabusContext(classId);

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
        const pathway = await generatePathwayForStudent(
          response,
          survey,
          syllabusContext,
          classId,
          surveyId
        );
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
    console.error("[GENERATE_LEARNING_PATHS]", error);
    return NextResponse.json(
      { error: "Failed to generate learning paths" },
      { status: 500 }
    );
  }
}

async function generatePathwayForStudent(
  response: {
    studentId: string;
    answers: unknown;
    student: { name: string | null; email: string };
  },
  survey: {
    questions: unknown;
    title: string;
  },
  syllabusContext: {
    courseDescription: string;
    learningObjectives: string;
    courseSchedule: string;
    assessmentMethods: string;
    prerequisites: string;
  },
  classId: string,
  surveyId: string
) {
  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const answers = Array.isArray(response.answers) ? response.answers : [];

  const prompt = buildPathwayPrompt(
    syllabusContext,
    questions as SurveyQuestion[],
    answers as SurveyAnswer[]
  );

  const generatePathwayFunction = getPathwayFunctionDeclaration();
  // Cast for @google/genai Type enum compatibility
  const functionDeclaration = {
    ...generatePathwayFunction,
    parameters: {
      ...generatePathwayFunction.parameters,
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              syllabusBlockId: { type: Type.STRING, enum: PATHWAY_BLOCK_IDS },
              type: { type: Type.STRING, enum: ["topic", "subtopic", "resource", "assessment"] },
              difficulty: { type: Type.STRING, enum: ["beginner", "intermediate", "advanced"] },
              duration: { type: Type.STRING },
              dependsOn: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              "id",
              "title",
              "description",
              "syllabusBlockId",
              "type",
              "difficulty",
              "duration",
              "dependsOn",
            ],
          },
        },
      },
      required: ["nodes"],
    },
  };

  const aiResponse = await geminiClient.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [
        {
          functionDeclarations: [functionDeclaration],
        },
      ],
    },
  });

  const functionCall = aiResponse.functionCalls?.[0];
  const nodes = functionCall?.args?.nodes;

  if (!nodes || !Array.isArray(nodes)) {
    throw new Error('Failed to generate pathway nodes');
  }

  // Delete any previous pathways for this student/class/survey combination
  await prisma.learningPathway.deleteMany({
    where: {
      studentId: response.studentId,
      classId,
      surveyId,
    },
  });

  // Create new pathway
  const pathway = await prisma.learningPathway.create({
    data: {
      studentId: response.studentId,
      classId,
      surveyId,
      status: 'pending',
      version: 1,
    },
  });

  // Create pathway nodes (syllabusBlockId embedded in description until schema supports it)
  await prisma.pathwayNode.createMany({
    data: (nodes as PathwayNodeInput[]).map((node) => ({
      pathwayId: pathway.id,
      nodeId: node.id,
      title: node.title,
      description: node.syllabusBlockId
        ? `[${node.syllabusBlockId}] ${node.description}`
        : node.description,
      type: node.type,
      difficulty: node.difficulty,
      duration: node.duration,
      dependsOn: node.dependsOn,
      flashcardsAdded: false,
      aiLessonComplete: false,
      quizScore: null,
    })),
  });

  return pathway;
}

async function getSyllabusContext(classId: string) {
  try {
    const syllabusResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/syllabus/content?classId=${classId}`
    );
    if (syllabusResponse.ok) {
      const syllabusData = await syllabusResponse.json();
      if (syllabusData.hasSyllabus) {
        return {
          courseDescription: syllabusData.content.courseDescription || '',
          learningObjectives: syllabusData.content.learningObjectives || '',
          courseSchedule: syllabusData.content.courseSchedule || '',
          assessmentMethods: syllabusData.content.assessmentMethods || '',
          prerequisites: syllabusData.content.prerequisites || '',
        };
      }
    }
  } catch (error) {
    console.error('Failed to fetch syllabus content:', error);
  }

  // Return empty context if syllabus not available
  return {
    courseDescription: '',
    learningObjectives: '',
    courseSchedule: '',
    assessmentMethods: '',
    prerequisites: '',
  };
}

