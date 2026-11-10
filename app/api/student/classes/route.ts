// app/api/student/classes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("enrollmentId");

  if (!studentId) {
    return NextResponse.json({ message: "Missing studentId" }, { status: 400 });
  }

  try {
    const classes = await prisma.class.findMany({
      where: {
        enrollments: {
          some: {
            studentId: studentId,
          },
        },
      },
      include: {
        professor: true,
      },
    });

    return NextResponse.json(classes);
  } catch (error) {
    console.error("[FETCH_STUDENT_CLASSES]", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}