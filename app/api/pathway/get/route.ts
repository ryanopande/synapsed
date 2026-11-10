import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  if (!studentId || !classId) return NextResponse.json({ nodes: [] });

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
