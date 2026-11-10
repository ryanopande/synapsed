import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from '@google/genai';
import { getSyllabusContext, getClassInfo } from "@/lib/survey/syllabusService";
import { prisma } from "@/lib/prisma";
import { GEMINI_MODEL } from "@/lib/gemini-model";

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// POST /api/surveys/generate - AI generation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, context, subject, level = "undergraduate" } = body;

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    // Get class information and syllabus context
    const classInfo = await getClassInfo(classId);
    if (!classInfo) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const syllabusContext = await getSyllabusContext(classId);

    // Generate survey using AI with contextual information
    const questions = await generateContextualSurvey(
      syllabusContext,
      context,
      subject,
      level
    );

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
    console.error("[SURVEY_GENERATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate survey" },
      { status: 500 }
    );
  }
}

async function generateContextualSurvey(
  syllabusContext: {
    courseName: string;
    courseDescription: string;
    hasSyllabus: boolean;
    syllabusConfidence: number;
    materialCount: number;
    learningObjectives?: string;
    courseSchedule?: string;
    prerequisites?: string;
    assessmentMethods?: string;
    gradingPolicy?: string;
  },
  userContext?: string,
  subject?: string,
  level: string = "undergraduate"
) {
  const prompt = `You are an expert educational assessment specialist. Generate a comprehensive student survey for personalized learning path creation based on the following course information:

COURSE DETAILS:
- Course Name: ${syllabusContext.courseName}
- Description: ${syllabusContext.courseDescription || 'Not provided'}
- Academic Level: ${level}
- Subject Area: ${subject || 'Not specified'}

SYLLABUS INFORMATION:
- Prerequisites: ${syllabusContext.prerequisites || 'No prerequisites specified'}
- Learning Objectives: ${syllabusContext.learningObjectives || 'No learning objectives specified'}
- Assessment Methods: ${syllabusContext.assessmentMethods || 'No assessment methods specified'}
- Course Schedule: ${syllabusContext.courseSchedule || 'No schedule specified'}
- Grading Policy: ${syllabusContext.gradingPolicy || 'No grading policy specified'}

SYLLABUS DATA QUALITY:
- Has Syllabus Data: ${syllabusContext.hasSyllabus}
- Processing Confidence: ${syllabusContext.syllabusConfidence}%
- Material Count: ${syllabusContext.materialCount}

${userContext ? `PROFESSOR'S ADDITIONAL CONTEXT:\n${userContext}\n` : ''}

Generate 10-15 survey questions that are specifically tailored to this course. Focus on:

1. PREREQUISITE ASSESSMENT (3-4 questions):
   - Based on the actual prerequisites: ${syllabusContext.prerequisites || 'general course background'}
   - Assess specific knowledge areas mentioned in prerequisites
   - Evaluate confidence in prerequisite skills
   - Identify knowledge gaps in required background

2. LEARNING OBJECTIVES READINESS (3-4 questions):
   - Based on the course learning objectives: ${syllabusContext.learningObjectives || 'course goals'}
   - Assess readiness for specific learning outcomes
   - Evaluate prior experience with course topics
   - Understand student expectations for course content

3. ASSESSMENT PREPARATION (2-3 questions):
   - Based on assessment methods: ${syllabusContext.assessmentMethods || 'general assessment preferences'}
   - Understand student preferences for evaluation methods
   - Assess comfort with different assessment types
   - Evaluate study and preparation strategies

4. COURSE-SPECIFIC GOALS (2-3 questions):
   - Based on course description: ${syllabusContext.courseDescription || 'general course information'}
   - Understand student goals aligned with course content
   - Assess motivation for taking this specific course
   - Evaluate career/academic goals related to course topics

5. LEARNING PREFERENCES & CHALLENGES (2-3 questions):
   - Identify learning style and preferences
   - Understand time availability and pace preferences
   - Assess anticipated challenges specific to this course content

IMPORTANT REQUIREMENTS:
- Make questions SPECIFIC to this course's actual content and prerequisites
- Reference actual prerequisite topics when available
- Align with actual learning objectives when available
- Use the course description to inform goal-related questions
- If syllabus data is limited, create more general but relevant questions
- Use clear, student-friendly language
- Ensure questions are actionable for creating personalized learning paths
- Questions should help identify student strengths, weaknesses, and interests`;

  const questionSchema = {
    name: 'generate_survey_questions',
    description: 'Generate survey questions for student assessment',
    parameters: {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: 'Unique question identifier' },
              text: { type: Type.STRING, description: 'Question text' },
              type: {
                type: Type.STRING,
                enum: ['multiple_choice', 'text', 'rating', 'ranking'],
                description: 'Question type',
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Options for multiple choice or ranking questions',
              },
              required: { type: Type.BOOLEAN, description: 'Whether question is required' },
              order: { type: Type.NUMBER, description: 'Display order' },
            },
            required: ['id', 'text', 'type', 'required', 'order'],
          },
        },
      },
      required: ['questions'],
    },
  };

  const response = await geminiClient.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [
        {
          functionDeclarations: [questionSchema],
        },
      ],
    },
  });

  const functionCall = response.functionCalls?.[0];
  const questions = functionCall?.args?.questions;

  if (!questions || !Array.isArray(questions)) {
    throw new Error('Failed to generate questions');
  }

  return questions;
}

