import { prisma } from "@/lib/db/prisma";

export interface ProgressCount {
  completed: number;
  total: number;
  /** 0-100, or null when there is nothing to complete yet. */
  percent: number | null;
}

export interface ClassAchievement {
  classId: string;
  title: string;
  professorName: string | null;
  hasPathway: boolean;
  lessons: ProgressCount;
  quizzes: ProgressCount;
  /** Every pathway lesson complete and every published quiz submitted. */
  completed: boolean;
}

export interface StudentAchievements {
  lessons: ProgressCount;
  quizzes: ProgressCount;
  classes: ProgressCount;
  perClass: ClassAchievement[];
}

function toProgress(completed: number, total: number): ProgressCount {
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : null,
  };
}

/**
 * Achievements for a student across all enrolled classes.
 * - Lessons: completed pathway lessons out of all lessons in the student's approved pathways.
 * - Quizzes: submitted published quizzes out of all published quizzes in enrolled classes.
 * - Classes: classes where the pathway is 100% complete and every published quiz is submitted.
 */
export async function getStudentAchievements(studentId: string): Promise<StudentAchievements> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { studentId },
    select: {
      class: { select: { id: true, title: true, professor: { select: { name: true } } } },
    },
  });
  const classIds = enrollments.map((e) => e.class.id);

  const [pathways, quizzes, responses] = await Promise.all([
    // Same pathways students see on the pathway page: approved only.
    prisma.learningPathway.findMany({
      where: { studentId, classId: { in: classIds }, status: "approved" },
      select: { classId: true, nodes: { select: { aiLessonComplete: true } } },
    }),
    prisma.professorQuiz.findMany({
      where: { classId: { in: classIds }, status: "PUBLISHED" },
      select: { id: true, classId: true },
    }),
    prisma.professorQuizResponse.findMany({
      where: { studentId, quiz: { classId: { in: classIds }, status: "PUBLISHED" } },
      select: { quizId: true },
    }),
  ]);

  const submittedQuizIds = new Set(responses.map((r) => r.quizId));

  const perClass: ClassAchievement[] = enrollments.map(({ class: cls }) => {
    // The pathway page shows the first approved pathway for a class; mirror that.
    const pathway = pathways.find((p) => p.classId === cls.id);
    const nodes = pathway?.nodes ?? [];
    const lessons = toProgress(nodes.filter((n) => n.aiLessonComplete).length, nodes.length);

    const classQuizzes = quizzes.filter((q) => q.classId === cls.id);
    const quizProgress = toProgress(
      classQuizzes.filter((q) => submittedQuizIds.has(q.id)).length,
      classQuizzes.length
    );

    return {
      classId: cls.id,
      title: cls.title,
      professorName: cls.professor?.name ?? null,
      hasPathway: !!pathway,
      lessons,
      quizzes: quizProgress,
      completed:
        lessons.total > 0 &&
        lessons.completed === lessons.total &&
        quizProgress.completed === quizProgress.total,
    };
  });

  const sum = (pick: (c: ClassAchievement) => number) => perClass.reduce((acc, c) => acc + pick(c), 0);

  return {
    lessons: toProgress(sum((c) => c.lessons.completed), sum((c) => c.lessons.total)),
    quizzes: toProgress(sum((c) => c.quizzes.completed), sum((c) => c.quizzes.total)),
    classes: toProgress(perClass.filter((c) => c.completed).length, perClass.length),
    perClass,
  };
}
