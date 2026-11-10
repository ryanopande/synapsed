import { prisma } from "@/lib/db/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WITHIN_DAYS = 7;
const INACTIVE_AFTER_DAYS = 14;
const LOW_SCORE = 60;
const LOW_PATHWAY_PERCENT = 25;

export type EngagementStatus = "active" | "quiet" | "inactive";

export type RiskFlag = "inactive" | "low-scores" | "missed-quizzes" | "low-pathway-progress";

export interface StudentAnalytics {
  studentId: string;
  name: string;
  email: string;
  engagement: {
    status: EngagementStatus;
    lastActivity: string | null;
    /** Distinct days with any activity in the last 14 days. */
    activeDays14: number;
    conversations: number;
    tutorMessages: number;
    lessonNotes: number;
  };
  pathway: {
    status: "none" | "pending" | "approved" | "rejected";
    completed: number;
    total: number;
    percent: number | null;
  };
  quizzes: {
    submitted: number;
    published: number;
    missedPastDue: number;
    averageScore: number | null;
  };
  popQuizzes: { taken: number; averageScore: number | null };
  /** Average of every scored professor quiz and pop quiz. */
  averageScore: number | null;
  riskFlags: RiskFlag[];
}

export interface ClassAnalytics {
  classId: string;
  className: string;
  generatedAt: string;
  overview: {
    students: number;
    activeStudents: number;
    averagePathwayPercent: number | null;
    averageScore: number | null;
    quizCompletionPercent: number | null;
    atRiskStudents: number;
  };
  students: StudentAnalytics[];
  assessments: {
    /** Counts of scores in 0-49, 50-69, 70-89, 90-100 across professor quizzes and pop quizzes. */
    scoreDistribution: { label: string; count: number }[];
    /** Published professor quizzes, oldest first. */
    quizzes: { quizId: string; title: string; publishedAt: string | null; submissions: number; averageScore: number | null }[];
    mostMissedQuestions: { questionId: string; quizTitle: string; text: string; correctPercent: number; answers: number }[];
  };
  pathways: {
    statusCounts: { none: number; pending: number; approved: number; rejected: number };
    completionByDifficulty: { difficulty: string; completed: number; total: number; percent: number | null }[];
    /** Lessons with the lowest average pop quiz score. */
    hardestLessons: { title: string; averageScore: number; attempts: number }[];
  };
}

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** Quiz question text may be plain text or BlockNote JSON; return readable text either way. */
function questionPlainText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const pieces = [...trimmed.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    if (pieces.length) return pieces.join(" ").replace(/\\n/g, " ").trim();
  }
  return trimmed;
}

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];

/**
 * Class analytics for professors: engagement, assessment performance,
 * pathway progress and at-risk students. Caller must check the professor owns the class.
 */
export async function getClassAnalytics(classId: string): Promise<ClassAnalytics | null> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { title: true } });
  if (!cls) return null;

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId },
    select: { student: { select: { id: true, name: true, email: true } } },
  });
  const studentIds = enrollments.map((e) => e.student.id);

  const [pathways, conversations, messages, notes, quizzes, quizResponses, answers, popResponses] = await Promise.all([
    prisma.learningPathway.findMany({
      where: { classId, studentId: { in: studentIds } },
      orderBy: { createdAt: "desc" },
      select: {
        studentId: true,
        status: true,
        nodes: { select: { aiLessonComplete: true, difficulty: true } },
      },
    }),
    prisma.conversation.findMany({
      where: { classId, userId: { in: studentIds } },
      select: { id: true, userId: true },
    }),
    prisma.message.findMany({
      where: { role: "USER", conversation: { classId, userId: { in: studentIds } } },
      select: { conversationId: true, timestamp: true },
    }),
    prisma.lessonNote.findMany({
      where: { classId, studentId: { in: studentIds } },
      select: { studentId: true, updatedAt: true },
    }),
    prisma.professorQuiz.findMany({
      where: { classId, status: "PUBLISHED" },
      orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, publishedAt: true, dueDate: true },
    }),
    prisma.professorQuizResponse.findMany({
      where: { studentId: { in: studentIds }, quiz: { classId, status: "PUBLISHED" } },
      select: { studentId: true, quizId: true, score: true, submittedAt: true },
    }),
    prisma.professorQuizAnswer.findMany({
      where: { isCorrect: { not: null }, response: { quiz: { classId, status: "PUBLISHED" } } },
      select: { questionId: true, isCorrect: true },
    }),
    prisma.inChatAssessmentResponse.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        score: true,
        submittedAt: true,
        assessment: {
          select: {
            nodeTitle: true,
            topic: true,
            conversation: { select: { classId: true } },
            node: { select: { title: true, pathway: { select: { classId: true } } } },
          },
        },
      },
    }),
  ]);

  // Pop quizzes belong to this class via their lesson's pathway, or the conversation they were taken in.
  const classPopResponses = popResponses.filter(
    (r) => (r.assessment.node?.pathway.classId ?? r.assessment.conversation?.classId) === classId
  );

  const conversationOwner = new Map(conversations.map((c) => [c.id, c.userId]));
  const now = Date.now();
  const quizById = new Map(quizzes.map((q) => [q.id, q]));

  const students: StudentAnalytics[] = enrollments.map(({ student }) => {
    const id = student.id;

    // Engagement: every timestamped action the student took in this class.
    const studentMessages = messages.filter((m) => conversationOwner.get(m.conversationId) === id);
    const studentNotes = notes.filter((n) => n.studentId === id);
    const studentQuizResponses = quizResponses.filter((r) => r.studentId === id);
    const studentPop = classPopResponses.filter((r) => r.studentId === id);
    const activityTimes = [
      ...studentMessages.map((m) => m.timestamp.getTime()),
      ...studentNotes.map((n) => n.updatedAt.getTime()),
      ...studentQuizResponses.map((r) => r.submittedAt.getTime()),
      ...studentPop.map((r) => r.submittedAt.getTime()),
    ];
    const lastActivity = activityTimes.length ? Math.max(...activityTimes) : null;
    const daysSince = lastActivity === null ? Infinity : (now - lastActivity) / DAY_MS;
    const status: EngagementStatus =
      daysSince <= ACTIVE_WITHIN_DAYS ? "active" : daysSince <= INACTIVE_AFTER_DAYS ? "quiet" : "inactive";
    const activeDays14 = new Set(
      activityTimes.filter((t) => now - t <= INACTIVE_AFTER_DAYS * DAY_MS).map((t) => new Date(t).toDateString())
    ).size;

    // Pathway: prefer the approved pathway (what the student sees), else the latest one.
    const studentPathways = pathways.filter((p) => p.studentId === id);
    const pathway = studentPathways.find((p) => p.status === "approved") ?? studentPathways[0];
    const nodes = pathway?.status === "approved" ? pathway.nodes : [];
    const completedNodes = nodes.filter((n) => n.aiLessonComplete).length;

    // Quizzes
    const submittedIds = new Set(studentQuizResponses.map((r) => r.quizId));
    const missedPastDue = quizzes.filter(
      (q) => q.dueDate && q.dueDate.getTime() < now && !submittedIds.has(q.id)
    ).length;
    const quizScores = studentQuizResponses.map((r) => r.score).filter((s): s is number => s !== null);
    const popScores = studentPop.map((r) => r.score).filter((s): s is number => s !== null);
    const averageScore = average([...quizScores, ...popScores]);
    const pathwayPercent = percent(completedNodes, nodes.length);

    const riskFlags: RiskFlag[] = [];
    if (status === "inactive") riskFlags.push("inactive");
    if (averageScore !== null && averageScore < LOW_SCORE) riskFlags.push("low-scores");
    if (missedPastDue > 0) riskFlags.push("missed-quizzes");
    if (pathwayPercent !== null && pathwayPercent < LOW_PATHWAY_PERCENT) riskFlags.push("low-pathway-progress");

    return {
      studentId: id,
      name: student.name ?? student.email,
      email: student.email,
      engagement: {
        status,
        lastActivity: lastActivity === null ? null : new Date(lastActivity).toISOString(),
        activeDays14,
        conversations: conversations.filter((c) => c.userId === id).length,
        tutorMessages: studentMessages.length,
        lessonNotes: studentNotes.length,
      },
      pathway: {
        status: (pathway?.status as StudentAnalytics["pathway"]["status"]) ?? "none",
        completed: completedNodes,
        total: nodes.length,
        percent: pathwayPercent,
      },
      quizzes: {
        submitted: submittedIds.size,
        published: quizzes.length,
        missedPastDue,
        averageScore: average(quizScores),
      },
      popQuizzes: { taken: studentPop.length, averageScore: average(popScores) },
      averageScore,
      riskFlags,
    };
  });

  // Assessments
  const allScores = [
    ...quizResponses.map((r) => r.score),
    ...classPopResponses.map((r) => r.score),
  ].filter((s): s is number => s !== null);
  const buckets = [
    { label: "0–49%", min: 0, max: 50 },
    { label: "50–69%", min: 50, max: 70 },
    { label: "70–89%", min: 70, max: 90 },
    { label: "90–100%", min: 90, max: Infinity },
  ];

  const questionIds = [...new Set(answers.map((a) => a.questionId))];
  const questions = questionIds.length
    ? await prisma.professorQuizQuestion.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, text: true, quizId: true },
      })
    : [];
  const mostMissedQuestions = questions
    .map((q) => {
      const qAnswers = answers.filter((a) => a.questionId === q.id);
      const correct = qAnswers.filter((a) => a.isCorrect).length;
      return {
        questionId: q.id,
        quizTitle: quizById.get(q.quizId)?.title ?? "Quiz",
        text: questionPlainText(q.text).slice(0, 200),
        correctPercent: percent(correct, qAnswers.length) ?? 0,
        answers: qAnswers.length,
      };
    })
    .filter((q) => q.correctPercent < 100)
    .sort((a, b) => a.correctPercent - b.correctPercent || b.answers - a.answers)
    .slice(0, 5);

  // Pathways
  const statusCounts = { none: 0, pending: 0, approved: 0, rejected: 0 };
  for (const s of students) statusCounts[s.pathway.status] += 1;

  const approvedNodes = students.flatMap((s) => {
    const studentPathways = pathways.filter((p) => p.studentId === s.studentId);
    return studentPathways.find((p) => p.status === "approved")?.nodes ?? [];
  });
  const completionByDifficulty = DIFFICULTY_ORDER.map((difficulty) => {
    const group = approvedNodes.filter((n) => n.difficulty?.toLowerCase() === difficulty);
    const completed = group.filter((n) => n.aiLessonComplete).length;
    return { difficulty, completed, total: group.length, percent: percent(completed, group.length) };
  }).filter((d) => d.total > 0);

  const lessonScores = new Map<string, number[]>();
  for (const r of classPopResponses) {
    if (r.score === null) continue;
    const title = r.assessment.node?.title ?? r.assessment.nodeTitle ?? r.assessment.topic;
    lessonScores.set(title, [...(lessonScores.get(title) ?? []), r.score]);
  }
  const hardestLessons = [...lessonScores.entries()]
    .map(([title, scores]) => ({ title, averageScore: average(scores) ?? 0, attempts: scores.length }))
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 5);

  const quizSubmissionsTotal = students.reduce((sum, s) => sum + s.quizzes.submitted, 0);

  return {
    classId,
    className: cls.title,
    generatedAt: new Date().toISOString(),
    overview: {
      students: students.length,
      activeStudents: students.filter((s) => s.engagement.status === "active").length,
      averagePathwayPercent: average(
        students.map((s) => s.pathway.percent).filter((p): p is number => p !== null)
      ),
      averageScore: average(allScores),
      quizCompletionPercent: percent(quizSubmissionsTotal, quizzes.length * students.length),
      atRiskStudents: students.filter((s) => s.riskFlags.length >= 2).length,
    },
    students,
    assessments: {
      scoreDistribution: buckets.map((b) => ({
        label: b.label,
        count: allScores.filter((s) => s >= b.min && s < b.max).length,
      })),
      quizzes: quizzes.map((q) => {
        const scores = quizResponses
          .filter((r) => r.quizId === q.id)
          .map((r) => r.score)
          .filter((s): s is number => s !== null);
        return {
          quizId: q.id,
          title: q.title,
          publishedAt: q.publishedAt?.toISOString() ?? null,
          submissions: quizResponses.filter((r) => r.quizId === q.id).length,
          averageScore: average(scores),
        };
      }),
      mostMissedQuestions,
    },
    pathways: { statusCounts, completionByDifficulty, hardestLessons },
  };
}
