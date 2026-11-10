import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireStudentOrClassProfessor } from "@/lib/auth";
// function to check if a pathway exists for a student in a class
export async function GET(
  req: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  const { classId, studentId } = await params;
  if (!classId || !studentId) {
    return NextResponse.json({ exists: false });
  }

  const authResult = await requireStudentOrClassProfessor(classId, studentId);
  if (!authResult.ok) return authResult.response;
  const pathway = await prisma.learningPathway.findFirst({
    where: { 
      classId, 
      studentId,
      status: "approved" // Only show approved pathways to students
    }
  });
  return NextResponse.json({ exists: !!pathway });
}
