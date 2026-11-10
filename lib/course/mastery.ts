import type { CourseTopic, MasteryProfile, TopicMastery } from "./types";

type StoredQuestion = {
  id?: string;
  questionId?: string;
  text?: string;
  kind?: string;
  topicId?: string;
  correctAnswer?: string;
};
type Answer = { questionId: string; answer: string };

const UNSURE = "I'm not sure";

/** Turns diagnostic answers into a per-topic mastery profile. */
export function computeMastery(
  questions: StoredQuestion[],
  answers: Answer[],
  topics: CourseTopic[]
): MasteryProfile {
  const answerById = new Map(answers.map((a) => [a.questionId, a.answer]));
  const stats: Record<string, TopicMastery> = {};
  for (const t of topics) {
    stats[t.id] = { level: "unassessed", score: null, correct: 0, total: 0, unsure: 0 };
  }

  const preferences: MasteryProfile["preferences"] = [];

  for (const q of questions) {
    const qid = q.id ?? q.questionId;
    if (!qid) continue;
    const answer = answerById.get(qid);
    if (answer === undefined) continue;

    if (q.kind === "knowledge" && q.topicId && stats[q.topicId] && q.correctAnswer) {
      const s = stats[q.topicId];
      s.total += 1;
      if (answer === q.correctAnswer) s.correct += 1;
      else if (answer === UNSURE) s.unsure += 1;
    } else {
      preferences.push({ question: q.text ?? "Unknown", answer });
    }
  }

  for (const s of Object.values(stats)) {
    if (s.total === 0) continue;
    s.score = s.correct / s.total;
    s.level = s.score >= 0.75 ? "strong" : s.score >= 0.4 ? "developing" : "weak";
  }
  return { topics: stats, preferences };
}
