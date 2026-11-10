import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isAdmin, requireUser } from "@/lib/auth";

// GET: classes the signed-in student is enrolled in. Admins may pass ?enrollmentId=<studentId>.
export async function GET(req: NextRequest) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { user } = authResult;

  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("enrollmentId");
  const studentId = requestedId && isAdmin(user) ? requestedId : user.id;

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