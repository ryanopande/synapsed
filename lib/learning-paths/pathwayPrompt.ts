import pathwaySpec from "../../study/data/prompts/pathway_generation_spec.json";

type SyllabusContext = {
  courseDescription: string;
  learningObjectives: string;
  courseSchedule: string;
  assessmentMethods: string;
  prerequisites: string;
};

type SurveyAnswer = { questionId: string; answer: string };
type SurveyQuestion = { id: string; text: string };

export const PATHWAY_BLOCK_IDS = pathwaySpec.blockIds as string[];

export function buildPathwayPrompt(
  syllabusContext: SyllabusContext,
  questions: SurveyQuestion[],
  answers: SurveyAnswer[]
): string {
  const qaLines = answers
    .map((ans) => {
      const q = questions.find((item) => item.id == ans.questionId);
      return `Q: ${q?.text || "Unknown"}\nA: ${ans.answer}`;
    })
    .join("\n");

  const blockCatalog = PATHWAY_BLOCK_IDS.map(
    (id) => `- ${id}: ${pathwaySpec.blockDescriptions[id as keyof typeof pathwaySpec.blockDescriptions]}`
  ).join("\n");

  const rulesText = pathwaySpec.personalizationRules
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join("\n");

  return `You are generating a STRUCTURALLY personalized learning pathway for a synthetic validation study.
The same syllabus must produce DIFFERENT block coverage — not just different node titles.

=== COURSE CONTEXT ===
Description: ${syllabusContext.courseDescription}
Prerequisites: ${syllabusContext.prerequisites}
Learning Objectives:
${syllabusContext.learningObjectives}
Course Schedule:
${syllabusContext.courseSchedule}
Assessment Methods: ${syllabusContext.assessmentMethods}

=== SYLLABUS BLOCK CATALOG (you MUST tag every node with syllabusBlockId) ===
${blockCatalog}

Valid syllabusBlockId values: ${PATHWAY_BLOCK_IDS.join(", ")}

=== STUDENT SURVEY RESPONSES ===
${qaLines}

=== PERSONALIZATION RULES (mandatory) ===
${rulesText}

=== OUTPUT REQUIREMENTS ===
- Call generate_learning_pathway with 10-14 nodes.
- Each node MUST include syllabusBlockId (one of the valid block ids).
- Vary block coverage based on survey — a confident CS researcher and an uncertain history major must NOT receive the same block sequence or block counts.
- learning_1 (learning style) affects ONLY the wording of descriptions — NEVER which blocks appear, how many nodes per block, difficulty, or order.
- Before finalizing, verify: would this pathway differ in block counts from a generic student? If not, revise block emphasis.

Generate the pathway now.`;
}

export function getPathwayFunctionDeclaration() {
  return {
    name: "generate_learning_pathway",
    description: "Generate a structurally personalized learning pathway with syllabus block tags",
    parameters: {
      type: "OBJECT",
      properties: {
        nodes: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              title: { type: "STRING" },
              description: { type: "STRING" },
              syllabusBlockId: { type: "STRING", enum: PATHWAY_BLOCK_IDS },
              type: { type: "STRING", enum: ["topic", "subtopic", "resource", "assessment"] },
              difficulty: { type: "STRING", enum: ["beginner", "intermediate", "advanced"] },
              duration: { type: "STRING" },
              dependsOn: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: [
              "id",
              "title",
              "description",
              "syllabusBlockId",
              "type",
              "difficulty",
              "duration",
              "dependsOn",
            ],
          },
        },
      },
      required: ["nodes"],
    },
  };
}
