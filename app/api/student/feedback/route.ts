import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getStudentFeedback } from "@/lib/students/feedback";

// GET: all feedback for the signed-in student, grouped by class
export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { user } = authResult;

  try {
    const classes = await getStudentFeedback(user.id);
    return NextResponse.json({ classes });
  } catch (error) {
    console.error("[STUDENT_FEEDBACK]", error);
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 });
  }
}
