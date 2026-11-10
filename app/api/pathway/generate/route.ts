
// /app/api/pathway/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { GEMINI_MODEL } from '@/lib/gemini-model';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type PathwayNodeInput = {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: string;
  dependsOn: string[];
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get('prompt') || 'Intro to linear algebra';
  const studentId = searchParams.get('studentId') || 'demo';
  const classId = searchParams.get('classId') || 'default';
  //console.log("prompt received", prompt)
  //console.log("studentId received", studentId)
  //console.log("ClassID received", classId)

  const generatePathwayFunction = {
    name: 'generate_learning_pathway',
    description: 'Generate a learning pathway of 8-12 structured nodes for a student based on a course prompt.',
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
                enum: ['topic', 'subtopic', 'resource', 'assessment']
              },
              difficulty: {
                type: Type.STRING,
                enum: ['beginner', 'intermediate', 'advanced']
              },
              duration: { type: Type.STRING },
              dependsOn: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['id', 'title', 'description', 'type', 'difficulty', 'duration', 'dependsOn']
          }
        }
      },
      required: ['nodes']
    }
  };
  

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
     contents: `
    Generate a learning pathway for the course "${prompt}".
    Return it by calling the function \`generate_learning_pathway\` with 8 to 12 nodes in the "nodes" array.
    Each node should be modular, with dependencies indicated using "dependsOn" by ID.
    `
    ,
    config: {
      tools: [{
        functionDeclarations: [generatePathwayFunction]
      }]
    }
  });

  const functionCall = response.functionCalls?.[0];
  const nodes = functionCall?.args?.nodes;
  
  if (!nodes) {
    return NextResponse.json({ error: 'No nodes returned' }, { status: 500 });
  }

  // saving everything in db 
  try {
    // Optional: delete previous pathways
    await prisma.learningPathway.deleteMany({
      where: { studentId, classId }
    });

    const newPathway = await prisma.learningPathway.create({
      data: {
        studentId,
        classId,
        status: 'pending'
      }
    });

    if (!Array.isArray(nodes)){
      return NextResponse.json({error: "No Nodes array returned"},{status:500});
    }

    await prisma.pathwayNode.createMany({
      data: (nodes as PathwayNodeInput[]).map((node) => ({
        pathwayId: newPathway.id,
        nodeId: node.id,
        title: node.title,
        description: node.description,
        type: node.type,
        difficulty: node.difficulty,
        duration: node.duration,
        dependsOn: node.dependsOn,
        flashcardsAdded: false,
        aiLessonComplete: false,
        quizScore: null
      }))
    });

    return NextResponse.json({ success: true, pathwayId: newPathway.id, nodes });
  } catch (error) {
    console.error('[SAVE_PATHWAY_ERROR]', error);
    return NextResponse.json({ error: 'Failed to save pathway' }, { status: 500 });
  }
  
  return NextResponse.json(nodes);
}
