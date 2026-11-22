import { FunctionCallingConfigMode, GoogleGenAI, Type } from "@google/genai";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GEMINI_MODEL } from "@/lib/gemini-model";
import {
  buildNodeExplanation,
  cleanText,
  evidenceStats,
  parseObjectives,
  type EvidenceItem,
  type RawNodeExplanation,
  type SurveyAnswer,
  type SurveyQuestionLike,
} from "./explanationVerify";

/**
 * "Why this node" explanations for instructors.
 *
 * Design (important for the study):
 *  - The pathway is generated first, unchanged. This module then asks the model to
 *    explain the FINISHED pathway. So adding explanations never changes which nodes
 *    a learner gets, and it can also be run on pathways that are already frozen.
 *  - The explanation is the model's written account of why the pathway fits the learner,
 *    not a trace of how it was computed. The UI labels it as AI-written.
 *  - Every quote the model cites is checked mechanically against the learner's real
 *    survey answers (and objectives against the syllabus). Unchecked items are flagged.
 *  - A failure here never breaks pathway generation: the pathway just has no explanation.
 *
 * Set PATHWAY_EXPLANATIONS=off to disable.
 */
export const EXPLANATIONS_ENABLED = process.env.PATHWAY_EXPLANATIONS !== "off";

export type ExplainResult = {
  ok: boolean;
  total: number;
  explained: number;
  verifiedEvidence: number;
  unverifiedEvidence: number;
  error?: string;
};

const FUNCTION_NAME = "explain_learning_pathway";

function stripBlockTag(description: string): { block: string; text: string } {
  const m = description.match(/^\[(block_[0-9a-z]+)\]\s*/);
  return m ? { block: m[1], text: description.slice(m[0].length) } : { block: "", text: description };
}

function buildExplainPrompt(args: {
  objectives: string[];
  questions: SurveyQuestionLike[];
  answers: SurveyAnswer[];
  nodes: { nodeId: string; title: string; description: string; difficulty: string; type: string; dependsOn: string[] }[];
}): string {
  const objectiveLines = args.objectives.length
    ? args.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
    : "(no learning objectives available)";

  const answerLines = args.answers
    .map((a) => {
      const q = args.questions.find((x) => (x.id ?? x.questionId) === a.questionId);
      return `[${a.questionId}] Q: ${q?.text ?? "Unknown question"}\nA: ${a.answer}`;
    })
    .join("\n");

  const nodeLines = args.nodes
    .map((n) => {
      const { block, text } = stripBlockTag(n.description);
      return `- id ${n.nodeId} | ${n.title} | ${n.difficulty} ${n.type}${block ? ` | course block ${block}` : ""} | depends on: ${
        n.dependsOn.length ? n.dependsOn.join(", ") : "none"
      }\n  ${text}`;
    })
    .join("\n");

  return `You are helping a university instructor decide whether to approve a personalised learning pathway for ONE student. Write the explanation the instructor needs to understand WHY the pathway looks the way it does.

=== COURSE LEARNING OBJECTIVES ===
${objectiveLines}

=== THE LEARNER'S SURVEY ANSWERS (question ids in square brackets) ===
${answerLines}

=== THE PATHWAY (already generated; do not change it) ===
${nodeLines}

=== WHAT TO RETURN ===
Call ${FUNCTION_NAME} once with:
- pathwaySummary: 2-3 plain sentences on the overall shape of this pathway and the main things the learner wrote that led to it.
- nodes: one entry for EVERY node id above. Each entry has:
  - id: the node id exactly as given.
  - rationale: 1-2 plain sentences on why this node is in THIS learner's pathway.
  - surveyEvidence: 0 to 3 short quotes copied word for word (max 15 words each) from the learner's survey answers that led to this node, each with its questionId.
  - courseObjective: copy exactly ONE line from the course learning objectives that this node supports, or "" if none fits.

RULES
- Quote only text that literally appears in the learner's answers. Never paraphrase inside a quote and never invent evidence.
- If a node is there because of the course's structure rather than something the learner wrote, say so plainly in the rationale and return an empty surveyEvidence list.
- Do not mention prompts, rules, tags or block ids. Speak to the instructor in terms of what the learner said and what the course aims to teach.
- Be specific to this learner. Avoid generic phrases such as "builds a strong foundation".`;
}

const explainFunction = {
  name: FUNCTION_NAME,
  description: "Explain, for an instructor, why each node of a learning pathway was chosen for this learner.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      pathwaySummary: { type: Type.STRING },
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            rationale: { type: Type.STRING },
            surveyEvidence: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  quote: { type: Type.STRING },
                },
                required: ["questionId", "quote"],
              },
            },
            courseObjective: { type: Type.STRING },
          },
          required: ["id", "rationale", "surveyEvidence", "courseObjective"],
        },
      },
    },
    required: ["pathwaySummary", "nodes"],
  },
};

async function loadLearningObjectives(classId: string): Promise<string[]> {
  const materials = await prisma.classMaterial.findMany({
    where: { classId, category: "SYLLABUS", syllabusProcessed: true },
    select: { learningObjectives: true },
  });
  return materials.flatMap((m) => parseObjectives(m.learningObjectives));
}

/** Generate, verify and save explanations for one existing pathway. Safe to re-run. */
export async function explainPathway(pathwayId: string): Promise<ExplainResult> {
  const fail = (error: string, total = 0): ExplainResult => ({
    ok: false,
    total,
    explained: 0,
    verifiedEvidence: 0,
    unverifiedEvidence: 0,
    error,
  });

  try {
    const pathway = await prisma.learningPathway.findUnique({
      where: { id: pathwayId },
      include: { nodes: { orderBy: { createdAt: "asc" } } },
    });
    if (!pathway) return fail("Pathway not found");
    if (pathway.nodes.length === 0) return fail("Pathway has no nodes");

    // The learner's answers: the survey this pathway was built from, else their latest in the class.
    const response =
      (pathway.surveyId
        ? await prisma.studentSurveyResponse.findFirst({
            where: { studentId: pathway.studentId, surveyId: pathway.surveyId },
            include: { survey: true },
          })
        : null) ??
      (await prisma.studentSurveyResponse.findFirst({
        where: { studentId: pathway.studentId, classId: pathway.classId },
        orderBy: { submittedAt: "desc" },
        include: { survey: true },
      }));
    if (!response) return fail("No survey response found for this learner", pathway.nodes.length);

    const answers = (Array.isArray(response.answers) ? response.answers : []) as SurveyAnswer[];
    const questions = (Array.isArray(response.survey?.questions) ? response.survey.questions : []) as SurveyQuestionLike[];
    const objectives = await loadLearningObjectives(pathway.classId);

    const prompt = buildExplainPrompt({
      objectives,
      questions,
      answers,
      nodes: pathway.nodes.map((n) => ({
        nodeId: n.nodeId,
        title: n.title,
        description: n.description,
        difficulty: n.difficulty,
        type: n.type,
        dependsOn: n.dependsOn,
      })),
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    type ExplainArgs = { pathwaySummary?: unknown; nodes?: unknown };
    const wantedIds = new Set(pathway.nodes.map((n) => n.nodeId));
    const coverage = (a: ExplainArgs | undefined) =>
      Array.isArray(a?.nodes)
        ? (a.nodes as RawNodeExplanation[]).filter((r) => typeof r?.id === "string" && wantedIds.has(r.id)).length
        : 0;
    const isComplete = (a: ExplainArgs | undefined) => coverage(a) === wantedIds.size && !!cleanText(a?.pathwaySummary, 10);

    let args: ExplainArgs | undefined; // the best answer seen so far
    let lastError = "";
    // Retry a few times: Gemini sometimes returns a temporary 503/429, skips the function call,
    // or answers for only some of the nodes. Keep the most complete answer.
    for (let attempt = 1; attempt <= 3 && !isComplete(args); attempt++) {
      try {
        const res = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            temperature: 0.2,
            toolConfig: {
              functionCallingConfig: {
                mode: FunctionCallingConfigMode.ANY,
                allowedFunctionNames: [FUNCTION_NAME],
              },
            },
            tools: [{ functionDeclarations: [explainFunction] }],
          },
        });
        const candidate = res.functionCalls?.[0]?.args as ExplainArgs | undefined;
        if (!candidate?.nodes) lastError = "Model did not return explanations";
        else if (!args || coverage(candidate) >= coverage(args)) args = candidate; // keep the most complete answer
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
      }
    }
    if (!args || !Array.isArray(args.nodes)) return fail(lastError || "Model did not return explanations", pathway.nodes.length);
    if (!isComplete(args)) {
      console.warn(`[EXPLAIN_PATHWAY] partial answer for ${pathway.id}: ${coverage(args)}/${wantedIds.size} nodes after retries`);
    }

    const byId = new Map<string, RawNodeExplanation>();
    for (const raw of args.nodes as RawNodeExplanation[]) {
      if (typeof raw?.id === "string") byId.set(raw.id, raw);
    }

    const evidenceLists: EvidenceItem[][] = [];
    let explained = 0;
    for (const node of pathway.nodes) {
      const raw = byId.get(node.nodeId);
      if (!raw) continue;
      const { rationale, evidence } = buildNodeExplanation(raw, { answers, questions, objectives });
      if (!rationale) continue;
      await prisma.pathwayNode.update({
        where: { id: node.id },
        data: { rationale, evidence: evidence as unknown as Prisma.InputJsonValue },
      });
      evidenceLists.push(evidence);
      explained++;
    }

    await prisma.learningPathway.update({
      where: { id: pathway.id },
      data: { rationaleSummary: cleanText(args.pathwaySummary, 700) },
    });

    const stats = evidenceStats(evidenceLists);
    return {
      ok: explained > 0,
      total: pathway.nodes.length,
      explained,
      verifiedEvidence: stats.verified,
      unverifiedEvidence: stats.unverified,
    };
  } catch (error) {
    console.error("[EXPLAIN_PATHWAY]", error);
    return fail(error instanceof Error ? error.message : "Unknown error");
  }
}

/** Called right after a pathway is saved. Never throws, so generation itself is unaffected. */
export async function explainPathwaySafely(pathwayId: string): Promise<void> {
  if (!EXPLANATIONS_ENABLED) return;
  const result = await explainPathway(pathwayId);
  if (!result.ok) console.error("[EXPLAIN_PATHWAY] not saved:", result.error ?? "no nodes explained");
}
