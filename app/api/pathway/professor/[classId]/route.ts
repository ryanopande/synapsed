import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch all pathways for a class with student info
export async function GET(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const { classId } = await params;

    const pathways = await prisma.learningPathway.findMany({
      where: { classId },
      include: {
        nodes: {
          select: {
            id: true,
            nodeId: true,
            title: true,
            description: true,
            type: true,
            difficulty: true,
            duration: true,
            dependsOn: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get student info for each pathway
    const pathwaysWithStudents = await Promise.all(
      pathways.map(async (pathway) => {
        const student = await prisma.user.findUnique({
          where: { id: pathway.studentId },
          select: { name: true, email: true }
        });

        return {
          id: pathway.id,
          studentId: pathway.studentId,
          studentName: student?.name || 'Unknown Student',
          studentEmail: student?.email || '',
          status: pathway.status,
          professorNotes: pathway.professorNotes,
          approvedAt: pathway.approvedAt,
          rejectedAt: pathway.rejectedAt,
          createdAt: pathway.createdAt,
          updatedAt: pathway.updatedAt,
          nodes: pathway.nodes,
          nodeCount: pathway.nodes.length
        };
      })
    );

    return NextResponse.json({ pathways: pathwaysWithStudents });
  } catch (error) {
    console.error("[PROFESSOR_PATHWAYS_GET]", error);
    return NextResponse.json({ error: "Failed to fetch pathways" }, { status: 500 });
  }
}

// PUT: Update pathway status (approve/reject)
export async function PUT(req: NextRequest) {
  try {
    const { pathwayId, status, professorNotes } = await req.json();

    if (!pathwayId || !status) {
      return NextResponse.json({ error: "Missing pathwayId or status" }, { status: 400 });
    }

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be 'approved' or 'rejected'" }, { status: 400 });
    }

    const updateData: {
      status: string;
      updatedAt: Date;
      approvedAt?: Date;
      rejectedAt?: Date | null;
      professorNotes?: string;
    } = {
      status,
      updatedAt: new Date()
    };

    if (status === "approved") {
      updateData.approvedAt = new Date();
      updateData.rejectedAt = undefined;
    } else if (status === "rejected") {
      updateData.rejectedAt = new Date();
      updateData.approvedAt = undefined;
    }

    if (professorNotes) {
      updateData.professorNotes = professorNotes;
    }

    const updatedPathway = await prisma.learningPathway.update({
      where: { id: pathwayId },
      data: updateData
    });

    return NextResponse.json({ 
      success: true, 
      pathway: updatedPathway 
    });
  } catch (error) {
    console.error("[PROFESSOR_PATHWAYS_PUT]", error);
    return NextResponse.json({ error: "Failed to update pathway" }, { status: 500 });
  }
}

// POST: Regenerate pathway with custom focus
export async function POST(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const { classId } = await params;
    const { studentId, focusText } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
    }

    // Delete existing pathway for this student
    await prisma.learningPathway.deleteMany({
      where: { studentId, classId }
    });

    // Get student's survey responses for regeneration
    const surveyResponse = await prisma.studentSurveyResponse.findFirst({
      where: { studentId, classId }
    });

    if (!surveyResponse) {
      return NextResponse.json({ error: "No survey response found for this student" }, { status: 404 });
    }

    // Get syllabus content
    let syllabusContent = "";
    let learningObjectives = "";
    let assessmentMethods = "";
    let prerequisites = "";
    let courseDescription = "";
    
    try {
      const syllabusResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/syllabus/content?classId=${classId}`);
      if (syllabusResponse.ok) {
        const syllabusData = await syllabusResponse.json();
        if (syllabusData.hasSyllabus) {
          syllabusContent = syllabusData.content.courseSchedule || "";
          learningObjectives = syllabusData.content.learningObjectives || "";
          assessmentMethods = syllabusData.content.assessmentMethods || "";
          prerequisites = syllabusData.content.prerequisites || "";
          courseDescription = syllabusData.content.courseDescription || "";
        }
      }
    } catch (error) {
      console.error("Failed to fetch syllabus content:", error);
    }

    // Get survey questions
    const survey = await prisma.survey.findFirst({ 
      where: { classId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });
    const questions = Array.isArray(survey?.questions) ? survey.questions : [];

    // Build enhanced prompt with focus text
    const basePrompt = 
      `Course Description:\n${courseDescription}\n\n` +
      `Prerequisites:\n${prerequisites}\n\n` +
      `Learning Objectives:\n${learningObjectives}\n\n` +
      `Course Schedule:\n${syllabusContent}\n\n` +
      `Assessment Methods:\n${assessmentMethods}\n\n` +
      `Student Survey Responses:\n` +
      (surveyResponse.answers as { questionId: string; answer: string }[]).map((ans) => {
        const q = (questions as { questionId?: string; id?: string; text?: string }[]).find((q) => q.questionId == ans.questionId || q.id == ans.questionId);
        return `Q: ${q?.text || "Unknown"}\nA: ${ans.answer}`;
      }).join("\n");

    const enhancedPrompt = focusText 
      ? `${basePrompt}\n\nPROFESSOR FOCUS: ${focusText}\n\nGenerate a new pathway that also addresses: ${focusText}`
      : basePrompt;

    // Generate new pathway
    const generateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/pathway/generate?studentId=${studentId}&classId=${classId}&prompt=${encodeURIComponent(enhancedPrompt)}`);
    
    if (!generateResponse.ok) {
      throw new Error("Failed to generate new pathway");
    }

    return NextResponse.json({ 
      success: true, 
      message: "Pathway regenerated successfully" 
    });
  } catch (error) {
    console.error("[PROFESSOR_PATHWAYS_POST]", error);
    return NextResponse.json({ error: "Failed to regenerate pathway" }, { status: 500 });
  }
}
