import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireStudentOrClassProfessor } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  if (!studentId || !classId) return NextResponse.json({ nodes: [] });

  const authResult = await requireStudentOrClassProfessor(classId, studentId);
  if (!authResult.ok) return authResult.response;

  const pathway = await prisma.learningPathway.findFirst({
    where: { 
      studentId, 
      classId,
      status: "approved" // Only return approved pathways to students
    },
    include: { nodes: true }
  });
  return NextResponse.json({ nodes: pathway?.nodes ?? [] });
}
