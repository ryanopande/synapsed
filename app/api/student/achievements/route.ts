import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getStudentAchievements } from "@/lib/students/achievements";

// GET: achievement percentages for the signed-in student
export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { user } = authResult;

  try {
    const achievements = await getStudentAchievements(user.id);
    return NextResponse.json(achievements);
  } catch (error) {
    console.error("[STUDENT_ACHIEVEMENTS]", error);
    return NextResponse.json({ error: "Failed to load achievements" }, { status: 500 });
  }
}
