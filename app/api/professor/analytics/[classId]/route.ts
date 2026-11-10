import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getClassAnalytics } from "@/lib/analytics/classAnalytics";

// GET: engagement, assessment, pathway and at-risk analytics for a class the professor teaches
export async function GET(_req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { user } = authResult;

  const { classId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(classId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { professorId: true } });
  if (!cls || cls.professorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const analytics = await getClassAnalytics(classId);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("[CLASS_ANALYTICS]", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
