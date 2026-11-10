import { prisma } from "@/lib/db/prisma";
import { getStudentAchievements, type ProgressCount } from "./achievements";

export interface PopQuizFeedback {
  id: string;
  topic: string;
  /** 0-100, or null when the quiz had no answer key. */
  score: number | null;
  feedback: string | null;
  submittedAt: string;
  /** The pathway lesson this pop quiz was taken in, when it can be linked. */
  lesson: { nodeId: string; title: string } | null;
}

export interface ProfessorQuizResult {
  quizId: string;
  title: string;
  score: number | null;
  submittedAt: string;
}

export interface ProfessorFeedbackNote {
  id: string;
  message: string;
  professorName: string | null;
  createdAt: string;
}

export interface ClassFeedback {
  classId: string;
  title: string;
  professorName: string | null;
  lessons: ProgressCount;
  quizzes: ProgressCount;
  professorFeedback: ProfessorFeedbackNote[];
  professorQuizzes: ProfessorQuizResult[];
  popQuizzes: PopQuizFeedback[];
}

/**
 * Everything a student has received feedback on, grouped by class:
 * pathway progress, professor-written feedback, professor quiz scores and
 * chatbot feedback from pop quizzes (linked back to the pathway lesson).
 * Pass classId to limit the result to one class.
 */
export async function getStudentFeedback(studentId: string, classId?: string): Promise<ClassFeedback[]> {
  const achievements = await getStudentAchievements(studentId);
  const classes = achievements.perClass.filter((c) => !classId || c.classId === classId);
  const classIds = classes.map((c) => c.classId);
  if (classIds.length === 0) return [];

  const [notes, quizResponses, popResponses] = await Promise.all([
    prisma.professorFeedback.findMany({
      where: { studentId, classId: { in: classIds } },
      orderBy: { createdAt: "desc" },
      select: { id: true, classId: true, message: true, createdAt: true, professor: { select: { name: true } } },
    }),
    prisma.professorQuizResponse.findMany({
      where: { studentId, quiz: { classId: { in: classIds } } },
      orderBy: { submittedAt: "desc" },
      select: { quizId: true, score: true, submittedAt: true, quiz: { select: { title: true, classId: true } } },
    }),
    prisma.inChatAssessmentResponse.findMany({
      where: { studentId },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        score: true,
        feedback: true,
        submittedAt: true,
        assessment: {
          select: {
            topic: true,
            nodeTitle: true,
            conversation: { select: { classId: true } },
            node: { select: { id: true, title: true, pathway: { select: { classId: true, studentId: true } } } },
          },
        },
      },
    }),
  ]);

  // Resolve each pop quiz to a class (and lesson, when it is in this student's own pathway).
  const popByClass = new Map<string, PopQuizFeedback[]>();
  for (const r of popResponses) {
    const { node, conversation } = r.assessment;
    const ownLesson = node && node.pathway.studentId === studentId ? node : null;
    const resolvedClassId = ownLesson?.pathway.classId ?? conversation?.classId ?? null;
    if (!resolvedClassId || !classIds.includes(resolvedClassId)) continue;

    const list = popByClass.get(resolvedClassId) ?? [];
    list.push({
      id: r.id,
      topic: r.assessment.topic,
      score: r.score === null ? null : Math.round(r.score),
      feedback: r.feedback,
      submittedAt: r.submittedAt.toISOString(),
      lesson: ownLesson ? { nodeId: ownLesson.id, title: ownLesson.title } : null,
    });
    popByClass.set(resolvedClassId, list);
  }

  return classes.map((c) => ({
    classId: c.classId,
    title: c.title,
    professorName: c.professorName,
    lessons: c.lessons,
    quizzes: c.quizzes,
    professorFeedback: notes
      .filter((n) => n.classId === c.classId)
      .map((n) => ({
        id: n.id,
        message: n.message,
        professorName: n.professor?.name ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    professorQuizzes: quizResponses
      .filter((q) => q.quiz.classId === c.classId)
      .map((q) => ({
        quizId: q.quizId,
        title: q.quiz.title,
        score: q.score === null ? null : Math.round(q.score),
        submittedAt: q.submittedAt.toISOString(),
      })),
    popQuizzes: popByClass.get(c.classId) ?? [],
  }));
}
