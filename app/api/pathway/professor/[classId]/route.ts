import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generatePathwayForStudent } from "@/lib/pathways/generatePathway";
import { NoCourseMaterialError } from "@/lib/course/topicMap";
import { isStudyServiceRequest, requireClassProfessor } from "@/lib/auth";

/** The class's professor, or the study pipeline's service key. */
async function authorize(req: NextRequest, classId: string) {
  if (isStudyServiceRequest(req)) return null;
  const authResult = await requireClassProfessor(classId);
  return authResult.ok ? null : authResult.response;
}

// GET: Fetch all pathways for a class with student info
export async function GET(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const { classId } = await params;
    const denied = await authorize(req, classId);
    if (denied) return denied;

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
export async function PUT(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const { classId } = await params;
    const denied = await authorize(req, classId);
    if (denied) return denied;

    const { pathwayId, status, professorNotes } = await req.json();

    if (!pathwayId || !status) {
      return NextResponse.json({ error: "Missing pathwayId or status" }, { status: 400 });
    }

    const pathway = await prisma.learningPathway.findFirst({
      where: { id: pathwayId, classId },
      select: { id: true },
    });
    if (!pathway) {
      return NextResponse.json({ error: "Pathway not found in this class" }, { status: 404 });
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
    const denied = await authorize(req, classId);
    if (denied) return denied;
    const { studentId, focusText } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
    }

    const surveyResponse = await prisma.studentSurveyResponse.findFirst({
      where: { studentId, classId },
      orderBy: { submittedAt: "desc" },
    });
    if (!surveyResponse) {
      return NextResponse.json({ error: "No survey response found for this student" }, { status: 404 });
    }

    const existing = await prisma.learningPathway.findFirst({
      where: { studentId, classId, surveyId: surveyResponse.surveyId },
    });

    await generatePathwayForStudent({
      classId,
      studentId,
      surveyId: surveyResponse.surveyId,
      focusArea: focusText || undefined,
      existingPathwayId: existing?.id,
    });

    return NextResponse.json({ success: true, message: "Pathway regenerated successfully" });
  } catch (error) {
    if (error instanceof NoCourseMaterialError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[PROFESSOR_PATHWAYS_POST]", error);
    return NextResponse.json({ error: "Failed to regenerate pathway" }, { status: 500 });
  }
}
