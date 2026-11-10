import { Prisma, type QuestionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { QuestionInput, QuestionOptionInput } from "@/lib/types/quizzes";

export interface GradableOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface GradableQuestion {
  id: string;
  type: QuestionType;
  options: GradableOption[];
}

export const isChoiceQuestion = (type: QuestionType) => type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE";

/**
 * Grade one answer against the question's answer key.
 * - Multiple choice / true-false: correct when the chosen option is marked correct.
 *   Returns null (needs grading) if the professor never marked a correct option.
 * - Short answer: always null; the professor grades it manually.
 */
export function autoGrade(
  question: GradableQuestion,
  answer: { optionId?: string | null; answerText?: string | null }
): { optionId: string | null; isCorrect: boolean | null } {
  if (!isChoiceQuestion(question.type)) {
    return { optionId: null, isCorrect: null };
  }
  const chosen =
    question.options.find((o) => o.id === answer.optionId) ??
    question.options.find((o) => answer.answerText != null && o.text === answer.answerText);
  if (!question.options.some((o) => o.isCorrect)) {
    return { optionId: chosen?.id ?? null, isCorrect: null };
  }
  return { optionId: chosen?.id ?? null, isCorrect: chosen ? chosen.isCorrect : false };
}

/** Score = correct answers / all questions. Unanswered and ungraded questions earn no credit yet. */
export function computeScore(questionCount: number, answers: { isCorrect: boolean | null }[]) {
  const correct = answers.filter((a) => a.isCorrect === true).length;
  const pending = answers.filter((a) => a.isCorrect === null).length;
  return {
    score: questionCount > 0 ? (correct / questionCount) * 100 : 0,
    correct,
    pending,
  };
}

/** Recompute a response's score from its answers, unless the professor set the score by hand. */
export async function recalculateResponseScore(responseId: string) {
  const response = await prisma.professorQuizResponse.findUnique({
    where: { id: responseId },
    select: {
      scoreOverridden: true,
      quiz: { select: { _count: { select: { questions: true } } } },
      answers: { select: { isCorrect: true } },
    },
  });
  if (!response || response.scoreOverridden) return;
  const { score } = computeScore(response.quiz._count.questions, response.answers);
  await prisma.professorQuizResponse.update({ where: { id: responseId }, data: { score } });
}

/**
 * Re-grade every submission's choice answers against the current answer key
 * (e.g. after the professor fixes a wrong or missing correct answer).
 * Short answers keep the grade the professor gave them.
 */
export async function regradeQuiz(quizId: string) {
  const quiz = await prisma.professorQuiz.findUnique({
    where: { id: quizId },
    select: {
      questions: { select: { id: true, type: true, options: { select: { id: true, text: true, isCorrect: true } } } },
      responses: { select: { id: true, answers: { select: { id: true, questionId: true, optionId: true, answerText: true, isCorrect: true } } } },
    },
  });
  if (!quiz) return;
  const questionById = new Map(quiz.questions.map((q) => [q.id, q]));

  for (const response of quiz.responses) {
    for (const answer of response.answers) {
      const question = questionById.get(answer.questionId);
      if (!question || !isChoiceQuestion(question.type)) continue;
      const graded = autoGrade(question, answer);
      if (graded.isCorrect !== answer.isCorrect || graded.optionId !== answer.optionId) {
        await prisma.professorQuizAnswer.update({
          where: { id: answer.id },
          data: { isCorrect: graded.isCorrect, optionId: graded.optionId },
        });
      }
    }
    await recalculateResponseScore(response.id);
  }
}

/** Choice questions the professor hasn't given a correct answer yet (blocks publishing). */
export function questionsMissingAnswerKey(
  questions: { order: number; type: QuestionType; options: { isCorrect: boolean }[] }[]
) {
  return questions.filter((q) => isChoiceQuestion(q.type) && !q.options.some((o) => o.isCorrect));
}

const toQuestionType = (type: QuestionInput["type"]) =>
  (typeof type === "string" ? type.toUpperCase().replace("-", "_") : type) as QuestionType;

/**
 * Save a quiz's questions in place. Questions and options whose ids already exist are updated
 * (so student answers keep pointing at them); new ones are created; missing ones are deleted.
 * Order follows the array position. Returns a map from client ids to database ids.
 */
export type SaveQuestionInput = Omit<QuestionInput, "options"> & {
  id?: string;
  options?: (QuestionOptionInput & { id?: string })[];
};

export async function saveQuizQuestions(quizId: string, questions: SaveQuestionInput[]) {
  const existing = await prisma.professorQuizQuestion.findMany({
    where: { quizId },
    select: { id: true, options: { select: { id: true } } },
  });
  const existingById = new Map(existing.map((q) => [q.id, q]));
  const idMap: Record<string, string> = {};
  const keptQuestionIds = new Set<string>();

  for (const [index, q] of questions.entries()) {
    const data = {
      text: q.text || "",
      richTextContent: (q.richTextContent ?? null) as Prisma.InputJsonValue,
      type: toQuestionType(q.type),
      imageUrl: q.imageUrl || null,
      order: index + 1,
    };
    const options = isChoiceQuestion(data.type) ? q.options ?? [] : [];
    const current = q.id ? existingById.get(q.id) : undefined;

    let questionId: string;
    if (current) {
      questionId = current.id;
      await prisma.professorQuizQuestion.update({ where: { id: questionId }, data });
    } else {
      const created = await prisma.professorQuizQuestion.create({ data: { ...data, quizId }, select: { id: true } });
      questionId = created.id;
    }
    if (q.id) idMap[q.id] = questionId;
    keptQuestionIds.add(questionId);

    const existingOptionIds = new Set(current?.options.map((o) => o.id) ?? []);
    const keptOptionIds = new Set<string>();
    for (const [optIndex, opt] of options.entries()) {
      const optData = { text: opt.text || "", isCorrect: !!opt.isCorrect, order: optIndex + 1 };
      let optionId: string;
      if (opt.id && existingOptionIds.has(opt.id)) {
        optionId = opt.id;
        await prisma.professorQuizOption.update({ where: { id: optionId }, data: optData });
      } else {
        const created = await prisma.professorQuizOption.create({
          data: { ...optData, questionId },
          select: { id: true },
        });
        optionId = created.id;
      }
      if (opt.id) idMap[opt.id] = optionId;
      keptOptionIds.add(optionId);
    }
    const removedOptionIds = [...existingOptionIds].filter((id) => !keptOptionIds.has(id));
    if (removedOptionIds.length) {
      await prisma.professorQuizOption.deleteMany({ where: { id: { in: removedOptionIds } } });
    }
  }

  const removedQuestionIds = existing.map((q) => q.id).filter((id) => !keptQuestionIds.has(id));
  if (removedQuestionIds.length) {
    // Answers aren't linked by relation, so remove answers to deleted questions explicitly.
    await prisma.professorQuizAnswer.deleteMany({ where: { questionId: { in: removedQuestionIds } } });
    await prisma.professorQuizQuestion.deleteMany({ where: { id: { in: removedQuestionIds } } });
  }

  return idMap;
}
