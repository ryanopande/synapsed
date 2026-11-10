import { Type } from "@google/genai";
import { prisma } from "@/lib/db/prisma";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { getOrBuildTopicMap } from "@/lib/course/topicMap";
import { computeMastery } from "@/lib/course/mastery";
import { getSyllabusContext } from "@/lib/surveys/syllabusService";
import type { CourseTopic, MasteryProfile } from "@/lib/course/types";

type GeneratedNode = {
  id: string;
  title: string;
  description: string;
  topicId?: string;
  type: string;
  difficulty: string;
  duration: string;
  dependsOn: string[];
};

function describeMastery(topics: CourseTopic[], profile: MasteryProfile): string {
  return topics
    .map((t) => {
      const m = profile.topics[t.id];
      const status =
        !m || m.level === "unassessed"
          ? "not assessed"
          : `${m.level.toUpperCase()} (${m.correct}/${m.total} correct${m.unsure ? `, ${m.unsure} unsure` : ""})`;
      const prereq = t.prerequisites.length ? ` | prerequisites: ${t.prerequisites.join(", ")}` : "";
      return `- ${t.id} "${t.title}": ${status}${prereq}\n    concepts: ${t.keyConcepts.join("; ")}`;
    })
    .join("\n");
}

function buildPrompt(args: {
  courseName: string;
  courseDescription: string;
  learningObjectives: string;
  assessmentMethods: string;
  topics: CourseTopic[];
  profile: MasteryProfile;
  focusArea?: string;
}): string {
  const { topics, profile } = args;
  const anyAssessed = Object.values(profile.topics).some((m) => m.level !== "unassessed");
  const prefs = profile.preferences.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join("\n");

  return `You are building a personalized learning pathway for ONE student in the course "${args.courseName}".
Use only the course topics below; they were derived from this course's syllabus and materials. Do not introduce subjects outside them.

COURSE DESCRIPTION: ${args.courseDescription}
LEARNING OBJECTIVES: ${args.learningObjectives}
ASSESSMENT METHODS: ${args.assessmentMethods}

COURSE TOPICS AND THIS STUDENT'S DIAGNOSTIC RESULT:
${describeMastery(topics, profile)}

STUDENT PREFERENCES / BACKGROUND:
${prefs || "(none provided)"}
${args.focusArea ? `\nPROFESSOR FOCUS AREA: ${args.focusArea}\n` : ""}
RULES:
1. Every node sets topicId to exactly one topic id above, and is about that topic's concepts.
2. ${
    anyAssessed
      ? `WEAK topics get 2-3 nodes starting at beginner difficulty. DEVELOPING topics get 1-2 nodes at intermediate difficulty. STRONG topics get at most one advanced/review node, or are skipped entirely if every prerequisite-dependent topic is also strong.`
      : `No diagnostic results exist, so give every topic 1-2 nodes at progressive difficulty.`
  }
3. Respect topic prerequisites: if a topic is weak and its prerequisite is weak or developing, cover the prerequisite first. Order nodes in teaching order and use dependsOn to point at the node ids that must come first.
4. Include at least one "assessment" node near the end that checks the topics this student found hardest.
5. Use the preferences only to adjust descriptions, pacing and duration, not to change which topics are covered.
6. Write each description concretely, naming the actual concepts from the topic. 8-16 nodes total, with unique ids like "n1", "n2".
Call generate_learning_pathway.`;
}

async function generateNodes(prompt: string, topics: CourseTopic[]): Promise<GeneratedNode[]> {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [
        {
          functionDeclarations: [
            {
              name: "generate_learning_pathway",
              description: "Generate a personalized learning pathway tied to course topics",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  nodes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        topicId: { type: Type.STRING, enum: topics.map((t) => t.id) },
                        type: { type: Type.STRING, enum: ["topic", "subtopic", "resource", "assessment"] },
                        difficulty: { type: Type.STRING, enum: ["beginner", "intermediate", "advanced"] },
                        duration: { type: Type.STRING },
                        dependsOn: { type: Type.ARRAY, items: { type: Type.STRING } },
                      },
                      required: ["id", "title", "description", "topicId", "type", "difficulty", "duration", "dependsOn"],
                    },
                  },
                },
                required: ["nodes"],
              },
            },
          ],
        },
      ],
    },
  });

  const nodes = response.functionCalls?.[0]?.args?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error("Failed to generate pathway nodes");

  // Drop dependencies that point at unknown or later-defined nodes so the graph stays valid.
  const seen = new Set<string>();
  return (nodes as GeneratedNode[]).map((node) => {
    const dependsOn = (node.dependsOn ?? []).filter((d) => seen.has(d) && d !== node.id);
    seen.add(node.id);
    return { ...node, dependsOn };
  });
}

/**
 * Generates (or regenerates) a student's pathway from the class's topic map and the
 * student's diagnostic result. Works for any course that has syllabus/content uploaded.
 */
export async function generatePathwayForStudent(args: {
  classId: string;
  studentId: string;
  surveyId: string;
  focusArea?: string;
  existingPathwayId?: string;
}) {
  const { classId, studentId, surveyId, focusArea, existingPathwayId } = args;

  const [survey, response, syllabus, topics] = await Promise.all([
    prisma.survey.findUnique({ where: { id: surveyId } }),
    prisma.studentSurveyResponse.findFirst({ where: { studentId, surveyId } }),
    getSyllabusContext(classId),
    getOrBuildTopicMap(classId),
  ]);
  if (!survey) throw new Error("Survey not found");
  if (!response) throw new Error("Student has not submitted this survey");

  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const answers = Array.isArray(response.answers) ? response.answers : [];
  const profile = computeMastery(
    questions as Parameters<typeof computeMastery>[0],
    answers as Parameters<typeof computeMastery>[1],
    topics
  );

  const prompt = buildPrompt({
    courseName: syllabus.courseName,
    courseDescription: syllabus.courseDescription,
    learningObjectives: syllabus.learningObjectives,
    assessmentMethods: syllabus.assessmentMethods,
    topics,
    profile,
    focusArea,
  });
  const nodes = await generateNodes(prompt, topics);
  const validTopicIds = new Set(topics.map((t) => t.id));

  let pathwayId: string;
  if (existingPathwayId) {
    const existing = await prisma.learningPathway.findUniqueOrThrow({ where: { id: existingPathwayId } });
    await prisma.pathwayNode.deleteMany({ where: { pathwayId: existingPathwayId } });
    await prisma.learningPathway.update({
      where: { id: existingPathwayId },
      data: {
        version: existing.version + 1,
        professorNotes: focusArea || existing.professorNotes,
        status: "pending",
        approvedAt: null,
        rejectedAt: null,
      },
    });
    pathwayId = existingPathwayId;
  } else {
    await prisma.learningPathway.deleteMany({ where: { studentId, classId, surveyId } });
    const created = await prisma.learningPathway.create({
      data: { studentId, classId, surveyId, status: "pending", version: 1, professorNotes: focusArea || null },
    });
    pathwayId = created.id;
  }

  await prisma.pathwayNode.createMany({
    data: nodes.map((node) => ({
      pathwayId,
      nodeId: node.id,
      topicId: node.topicId && validTopicIds.has(node.topicId) ? node.topicId : null,
      title: node.title,
      description: node.description,
      type: node.type,
      difficulty: node.difficulty,
      duration: node.duration,
      dependsOn: node.dependsOn,
      flashcardsAdded: false,
      aiLessonComplete: false,
      quizScore: null,
    })),
  });

  await prisma.studentSurveyResponse.update({
    where: { id: response.id },
    data: { mastery: profile as unknown as object },
  });

  return prisma.learningPathway.findUniqueOrThrow({ where: { id: pathwayId } });
}
