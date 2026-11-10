import { prisma } from "@/lib/db/prisma";
import { incompletePrerequisites } from "./locks";

/** Minimum pop quiz score (best attempt) needed before a lesson can be marked complete. */
export const LESSON_PASSING_SCORE = 70;

export interface LessonAccess {
  nodeId: string;
  title: string;
  complete: boolean;
  locked: boolean;
  /** Titles of the lessons that must be completed first. */
  waitingOn: string[];
  /** Best pop quiz score for this lesson, 0-100, or null if none taken. */
  bestPopQuizScore: number | null;
  passingScore: number;
  /** Unlocked, not yet complete, and a pop quiz passed. */
  canComplete: boolean;
}

/**
 * Access and completion state of one lesson for a student. Returns null when the
 * lesson isn't part of that student's own pathway.
 */
export async function getLessonAccess(nodeId: string, studentId: string): Promise<LessonAccess | null> {
  if (!/^[a-f0-9]{24}$/i.test(nodeId)) return null;

  const node = await prisma.pathwayNode.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      nodeId: true,
      title: true,
      dependsOn: true,
      aiLessonComplete: true,
      pathway: {
        select: {
          studentId: true,
          nodes: { select: { nodeId: true, title: true, dependsOn: true, aiLessonComplete: true } },
        },
      },
    },
  });
  if (!node || node.pathway.studentId !== studentId) return null;

  const waitingOn = incompletePrerequisites(node, node.pathway.nodes).map((n) => n.title);

  const best = await prisma.inChatAssessmentResponse.findFirst({
    where: { studentId, score: { not: null }, assessment: { nodeId: node.id } },
    orderBy: { score: "desc" },
    select: { score: true },
  });
  const bestPopQuizScore = best?.score == null ? null : Math.round(best.score);
  const locked = waitingOn.length > 0;

  return {
    nodeId: node.id,
    title: node.title,
    complete: node.aiLessonComplete,
    locked,
    waitingOn,
    bestPopQuizScore,
    passingScore: LESSON_PASSING_SCORE,
    canComplete:
      !locked &&
      !node.aiLessonComplete &&
      bestPopQuizScore !== null &&
      bestPopQuizScore >= LESSON_PASSING_SCORE,
  };
}
