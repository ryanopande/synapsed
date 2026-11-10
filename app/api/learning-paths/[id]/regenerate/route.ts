import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL } from "@/lib/gemini-model";

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type PathwayNodeInput = {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: string;
  dependsOn: string[];
};

// POST /api/learning-paths/[id]/regenerate - Regenerate a learning path
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const pathwayId = params.id;
    const body = await req.json();
    const { focusArea } = body; // Optional focus area from professor notes

    if (!pathwayId) {
      return NextResponse.json(
        { error: "Pathway ID is required" },
        { status: 400 }
      );
    }

    // Get existing pathway with all related data
    const existingPathway = await prisma.learningPathway.findUnique({
      where: { id: pathwayId },
      include: {
        survey: {
          include: {
            responses: {
              where: {
                studentId: {
                  // Will be filtered by pathway's studentId
                },
              },
            },
          },
        },
      },
    });

    if (!existingPathway) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    // Get student's survey response
    const response = await prisma.studentSurveyResponse.findFirst({
      where: {
        studentId: existingPathway.studentId,
        surveyId: existingPathway.surveyId || undefined,
      },
      include: {
        student: {
          select: { name: true, email: true },
        },
        survey: true,
      },
    });

    if (!response || !response.survey) {
      return NextResponse.json(
        { error: "Survey response not found" },
        { status: 404 }
      );
    }

    // Get syllabus context
    const syllabusContext = await getSyllabusContext(existingPathway.classId);

    // Generate new pathway with focus area if provided
    const questions = Array.isArray(response.survey.questions)
      ? response.survey.questions
      : [];
    const answers = Array.isArray(response.answers) ? response.answers : [];

    const prompt = `Course Information:
${syllabusContext.courseDescription ? `Description: ${syllabusContext.courseDescription}\n` : ''}
${syllabusContext.prerequisites ? `Prerequisites: ${syllabusContext.prerequisites}\n` : ''}
${syllabusContext.learningObjectives ? `Learning Objectives: ${syllabusContext.learningObjectives}\n` : ''}
${syllabusContext.courseSchedule ? `Course Schedule: ${syllabusContext.courseSchedule}\n` : ''}
${syllabusContext.assessmentMethods ? `Assessment Methods: ${syllabusContext.assessmentMethods}\n` : ''}

Student Survey Responses:
${(answers as { questionId: string; answer: string }[])
  .map((ans) => {
    const q = (questions as { id: string; text: string }[]).find(
      (q) => q.id == ans.questionId
    );
    return `Q: ${q?.text || "Unknown"}\nA: ${ans.answer}`;
  })
  .join("\n")}

${focusArea ? `\nProfessor's Focus Area: ${focusArea}\n` : ''}

This is a regeneration request${focusArea ? ' with specific focus area from the professor' : ''}.
Generate a new personalized learning pathway that:
1. Aligns with the course learning objectives and schedule
2. Considers the student's learning preferences, prior knowledge, and interests
3. Takes into account any prerequisites or background knowledge gaps
${focusArea ? `4. Places special emphasis on: ${focusArea}` : '4. Provides comprehensive coverage of course material'}
5. Incorporates the assessment methods and grading structure
6. Provides a structured progression through the course material with clear dependencies

Create 10-14 pathway nodes that form a coherent learning journey.`;

    // Generate new pathway
    const generatePathwayFunction = {
      name: 'generate_learning_pathway',
      description: 'Generate a learning pathway of structured nodes for a student',
      parameters: {
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
                type: {
                  type: Type.STRING,
                  enum: ['topic', 'subtopic', 'resource', 'assessment'],
                },
                difficulty: {
                  type: Type.STRING,
                  enum: ['beginner', 'intermediate', 'advanced'],
                },
                duration: { type: Type.STRING },
                dependsOn: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'id',
                'title',
                'description',
                'type',
                'difficulty',
                'duration',
                'dependsOn',
              ],
            },
          },
        },
        required: ['nodes'],
      },
    };

    const aiResponse = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [
          {
            functionDeclarations: [generatePathwayFunction],
          },
        ],
      },
    });

    const functionCall = aiResponse.functionCalls?.[0];
    const nodes = functionCall?.args?.nodes;

    if (!nodes || !Array.isArray(nodes)) {
      throw new Error('Failed to generate pathway nodes');
    }

    // Delete old nodes
    await prisma.pathwayNode.deleteMany({
      where: { pathwayId: existingPathway.id },
    });

    // Update pathway with new version and notes
    const updatedPathway = await prisma.learningPathway.update({
      where: { id: pathwayId },
      data: {
        version: existingPathway.version + 1,
        professorNotes: focusArea || existingPathway.professorNotes,
        status: 'pending', // Reset to pending for professor approval
        approvedAt: null,
        rejectedAt: null,
      },
    });

    // Create new nodes
    await prisma.pathwayNode.createMany({
      data: (nodes as PathwayNodeInput[]).map((node) => ({
        pathwayId: updatedPathway.id,
        nodeId: node.id,
        title: node.title,
        description: node.description,
        type: node.type,
        difficulty: node.difficulty,
        duration: node.duration,
        dependsOn: node.dependsOn,
        flashcardsAdded: false,
        aiLessonComplete: false,
        quizScore: null,
      })),
    });

    return NextResponse.json({
      success: true,
      pathway: updatedPathway,
      message: 'Pathway regenerated successfully',
    });
  } catch (error) {
    console.error("[REGENERATE_PATHWAY]", error);
    return NextResponse.json(
      { error: "Failed to regenerate pathway" },
      { status: 500 }
    );
  }
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

  return {
    courseDescription: '',
    learningObjectives: '',
    courseSchedule: '',
    assessmentMethods: '',
    prerequisites: '',
  };
}

