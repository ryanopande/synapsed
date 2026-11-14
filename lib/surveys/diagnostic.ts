import { FunctionCallingConfigMode, Type } from "@google/genai";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { getOrBuildTopicMap } from "@/lib/course/topicMap";
import type { CourseTopic } from "@/lib/course/types";

export const UNSURE_OPTION = "I'm not sure";

export type DiagnosticQuestion = {
  id: string;
  text: string;
  type: "multiple_choice" | "text" | "rating";
  options?: string[];
  required: boolean;
  order: number;
  kind: "knowledge" | "preference";
  topicId?: string;
  correctAnswer?: string;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function generateKnowledgeQuestions(
  courseName: string,
  topics: CourseTopic[]
): Promise<DiagnosticQuestion[]> {
  const topicList = topics
    .map((t) => `- ${t.id}: ${t.title} — ${t.summary} (concepts: ${t.keyConcepts.join(", ")})`)
    .join("\n");

  const perTopic = topics.length > 10 ? 1 : 2;
  const prompt = `Write a diagnostic quiz that checks what a student ALREADY knows before taking the course "${courseName}".
Course topics:
${topicList}

Rules:
- Write ${perTopic} multiple-choice question(s) for EACH topic, using that topic's own concepts. Every question must set topicId to one of the ids above.
- Each question has exactly 4 options and exactly one correct option; correctAnswer must be copied verbatim from options.
- Mix difficulty: one foundational question and (if ${perTopic} > 1) one that needs deeper understanding.
- Questions must be answerable without the course material and must not be trick questions.
Call create_diagnostic_questions.`;

  const callGemini = () => gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      // Force the function call so the model can't answer in plain text instead.
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["create_diagnostic_questions"],
        },
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: "create_diagnostic_questions",
              description: "Create multiple-choice diagnostic questions tagged by topic",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        topicId: { type: Type.STRING, enum: topics.map((t) => t.id) },
                        text: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.STRING },
                      },
                      required: ["topicId", "text", "options", "correctAnswer"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          ],
        },
      ],
    },
  });

  let raw: unknown;
  let lastDetail = "";
  for (let attempt = 1; attempt <= 2 && !Array.isArray(raw); attempt++) {
    try {
      const response = await callGemini();
      raw = response.functionCalls?.[0]?.args?.questions;
      if (!Array.isArray(raw)) {
        lastDetail = `finishReason=${response.candidates?.[0]?.finishReason} text=${(response.text ?? "").slice(0, 200)}`;
        console.error(`[DIAGNOSTIC] attempt ${attempt}: no function call. ${lastDetail}`);
      }
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : String(err);
      console.error(`[DIAGNOSTIC] attempt ${attempt} Gemini error:`, lastDetail);
    }
  }
  if (!Array.isArray(raw)) throw new Error(`Failed to generate diagnostic questions: ${lastDetail}`);

  const validTopics = new Set(topics.map((t) => t.id));
  const questions: DiagnosticQuestion[] = [];
  for (const item of raw as { topicId?: string; text?: string; options?: string[]; correctAnswer?: string }[]) {
    if (!item.text || !item.topicId || !validTopics.has(item.topicId)) continue;
    const options = Array.isArray(item.options) ? item.options.map(String) : [];
    if (options.length < 2 || !item.correctAnswer || !options.includes(item.correctAnswer)) continue;
    questions.push({
      id: "",
      text: item.text,
      type: "multiple_choice",
      // shuffled so the answer position is not predictable; "unsure" is always last and never correct
      options: [...shuffle(options), UNSURE_OPTION],
      required: true,
      order: 0,
      kind: "knowledge",
      topicId: item.topicId,
      correctAnswer: item.correctAnswer,
    });
  }
  return questions;
}

function preferenceQuestions(courseName: string): Omit<DiagnosticQuestion, "id" | "order">[] {
  return [
    {
      text: `What do you most want to get out of ${courseName}?`,
      type: "text",
      required: true,
      kind: "preference",
    },
    {
      text: "How do you prefer to learn new material?",
      type: "multiple_choice",
      options: [
        "Worked examples and diagrams",
        "Hands-on practice problems",
        "Reading and written explanations",
        "Discussion and Q&A",
      ],
      required: true,
      kind: "preference",
    },
    {
      text: "How much time per week can you dedicate to this course?",
      type: "multiple_choice",
      options: ["Under 3 hours", "3-5 hours", "6-9 hours", "10+ hours"],
      required: true,
      kind: "preference",
    },
  ];
}

/**
 * Builds a survey whose knowledge questions come from the class's own topic map
 * (syllabus + uploaded content) so it works for any course.
 */
export async function generateDiagnosticSurvey(
  classId: string,
  courseName: string
): Promise<{ questions: DiagnosticQuestion[]; topics: CourseTopic[] }> {
  const topics = await getOrBuildTopicMap(classId);
  const knowledge = await generateKnowledgeQuestions(courseName, topics);
  if (knowledge.length === 0) throw new Error("No valid diagnostic questions were generated");

  const all = [...knowledge, ...preferenceQuestions(courseName).map((q) => ({ ...q, id: "", order: 0 }))];
  const questions = all.map((q, index) => ({
    ...q,
    id: q.kind === "knowledge" ? `k_${q.topicId}_${index}` : `pref_${index}`,
    order: index,
  }));
  return { questions, topics };
}

/** Removes answer keys before sending a survey to students. */
export function stripAnswerKeys<T extends { correctAnswer?: unknown }>(questions: T[]): Omit<T, "correctAnswer">[] {
  return questions.map((q) => {
    const rest = { ...q };
    delete rest.correctAnswer;
    return rest;
  });
}
