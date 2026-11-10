import { NextRequest, NextResponse } from "next/server";
import { requireClassProfessor } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getStudentFeedback } from "@/lib/students/feedback";

type Params = { params: Promise<{ classId: string; studentId: string }> };

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MAX_MESSAGE_LENGTH = 5000;

/** The signed-in user must teach this class and the student must be enrolled in it. */
async function authorize(classId: string, studentId: string) {
  if (!OBJECT_ID.test(classId) || !OBJECT_ID.test(studentId)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const authResult = await requireClassProfessor(classId);
  if (!authResult.ok) return { error: authResult.response };

  const enrollment = await prisma.classEnrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
    select: { student: { select: { id: true, name: true, email: true } } },
  });
  if (!enrollment) {
    return { error: NextResponse.json({ error: "Student is not enrolled in this class" }, { status: 404 }) };
  }

  return { professorId: authResult.user.id, student: enrollment.student };
}

// GET: the student's progress and feedback in this class, for the professor writing feedback
export async function GET(_req: NextRequest, { params }: Params) {
  const { classId, studentId } = await params;
  const result = await authorize(classId, studentId);
  if ("error" in result) return result.error;

  try {
    const [feedback] = await getStudentFeedback(studentId, classId);
    return NextResponse.json({ student: result.student, feedback: feedback ?? null });
  } catch (error) {
    console.error("[PROFESSOR_FEEDBACK_GET]", error);
    return NextResponse.json({ error: "Failed to load student feedback" }, { status: 500 });
  }
}

// POST { message }: add a feedback note for the student
export async function POST(req: NextRequest, { params }: Params) {
  const { classId, studentId } = await params;
  const result = await authorize(classId, studentId);
  if ("error" in result) return result.error;

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Feedback message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Feedback must be ${MAX_MESSAGE_LENGTH} characters or fewer` }, { status: 400 });
  }

  try {
    const note = await prisma.professorFeedback.create({
      data: { classId, studentId, professorId: result.professorId, message },
      select: { id: true, message: true, createdAt: true, professor: { select: { name: true } } },
    });
    return NextResponse.json(
      {
        id: note.id,
        message: note.message,
        professorName: note.professor?.name ?? null,
        createdAt: note.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PROFESSOR_FEEDBACK_POST]", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
