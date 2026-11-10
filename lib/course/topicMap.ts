import { Type } from "@google/genai";
import { prisma } from "@/lib/db/prisma";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { ocrFromUrl } from "@/lib/ai/mistral";
import { getSyllabusContext } from "@/lib/surveys/syllabusService";
import type { CourseTopic } from "./types";

const MAX_CHARS_PER_DOC = 12_000;
const MAX_CONTENT_CHARS = 60_000;

export class NoCourseMaterialError extends Error {
  constructor(message = "No syllabus or course content has been uploaded and processed for this class yet.") {
    super(message);
    this.name = "NoCourseMaterialError";
  }
}

/**
 * Text of a content file (slides, notes). OCR runs once and is cached on the material.
 */
async function getMaterialText(material: {
  id: string;
  url: string;
  extractedText: string | null;
}): Promise<{ text: string; error?: string }> {
  if (material.extractedText) return { text: material.extractedText };
  try {
    const pages = await ocrFromUrl(material.url);
    const text = pages.map((p) => `--- Slide/Page ${p.page} ---\n${p.markdown}`).join("\n\n");
    await prisma.classMaterial.update({ where: { id: material.id }, data: { extractedText: text } });
    return { text };
  } catch (error) {
    console.error(`Failed to read content material ${material.id}:`, error);
    const status = (error as { statusCode?: number }).statusCode;
    return { text: "", error: status === 429 ? "OCR service rate limit exceeded" : "OCR failed" };
  }
}

async function gatherContentText(classId: string): Promise<{ text: string; ocrError?: string }> {
  const materials = await prisma.classMaterial.findMany({
    where: { classId, category: { in: ["CONTENT", "EXERCISES"] }, type: { in: ["PDF", "DOCX"] } },
    orderBy: { uploadedAt: "asc" },
    select: { id: true, title: true, url: true, extractedText: true },
  });

  const parts: string[] = [];
  let total = 0;
  let ocrError: string | undefined;
  for (const material of materials) {
    if (total >= MAX_CONTENT_CHARS) break;
    const result = await getMaterialText(material);
    ocrError ??= result.error;
    const text = result.text.slice(0, MAX_CHARS_PER_DOC);
    if (!text) continue;
    parts.push(`### ${material.title}\n${text}`);
    total += text.length;
  }
  return { text: parts.join("\n\n"), ocrError };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

function normalizeTopics(raw: unknown): CourseTopic[] {
  if (!Array.isArray(raw)) return [];

  const topics: CourseTopic[] = [];
  const used = new Set<string>();
  const idByRawId = new Map<string, string>();

  raw.forEach((item, index) => {
    const t = item as Partial<CourseTopic>;
    if (!t?.title) return;
    let id = `t${index + 1}_${slug(t.title)}`;
    while (used.has(id)) id += "_";
    used.add(id);
    if (t.id) idByRawId.set(String(t.id), id);
    idByRawId.set(id, id);
    topics.push({
      id,
      title: String(t.title),
      summary: String(t.summary ?? ""),
      keyConcepts: Array.isArray(t.keyConcepts) ? t.keyConcepts.map(String) : [],
      prerequisites: Array.isArray(t.prerequisites) ? t.prerequisites.map(String) : [],
      order: index,
    });
  });

  // Map prerequisite references onto final ids; drop unknown and self references.
  for (const topic of topics) {
    topic.prerequisites = Array.from(
      new Set(
        topic.prerequisites
          .map((p) => idByRawId.get(p))
          .filter((p): p is string => !!p && p !== topic.id)
      )
    );
  }
  return topics;
}

async function generateTopicMap(classId: string): Promise<CourseTopic[]> {
  const syllabus = await getSyllabusContext(classId);
  const { text: contentText, ocrError } = await gatherContentText(classId);

  if (!syllabus.hasSyllabus && !contentText) {
    // Materials exist but couldn't be read: say so instead of claiming nothing was uploaded
    throw new NoCourseMaterialError(
      ocrError ? `Couldn't read the uploaded course materials (${ocrError}). Please try again later.` : undefined
    );
  }

  const prompt = `You are a curriculum designer. Break the course below into an ordered list of 6-14 teachable topics.
Base the topics ONLY on the course material provided; do not add topics that the syllabus or content do not cover,
and do not assume the course belongs to any particular subject.

COURSE: ${syllabus.courseName}
Description: ${syllabus.courseDescription}
Prerequisites: ${syllabus.prerequisites}
Learning objectives: ${syllabus.learningObjectives}
Schedule: ${syllabus.courseSchedule}

COURSE CONTENT (slides / notes uploaded by the professor):
${contentText || "(none uploaded)"}

For each topic give: a stable short id, a title, a 1-2 sentence summary, 3-6 key concepts taken from the material,
and the ids of topics that should be understood first (prerequisites, only ids from your own list).
Order topics in the sequence the course teaches them. Call define_course_topics.`;

  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [
        {
          functionDeclarations: [
            {
              name: "define_course_topics",
              description: "Define the ordered topics of a course",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  topics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
                      },
                      required: ["id", "title", "summary", "keyConcepts", "prerequisites"],
                    },
                  },
                },
                required: ["topics"],
              },
            },
          ],
        },
      ],
    },
  });

  const topics = normalizeTopics(response.functionCalls?.[0]?.args?.topics);
  if (topics.length < 3) throw new Error("Could not derive a topic map from the course material");
  return topics;
}

/**
 * Returns the class's topic map, rebuilding it when missing or when materials
 * were uploaded after it was last built.
 */
export async function getOrBuildTopicMap(
  classId: string,
  opts: { force?: boolean } = {}
): Promise<CourseTopic[]> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { topicMap: true, topicMapUpdatedAt: true },
  });

  const cached = Array.isArray(cls?.topicMap) ? (cls!.topicMap as unknown as CourseTopic[]) : null;

  if (cached && cached.length > 0 && !opts.force && cls?.topicMapUpdatedAt) {
    const newer = await prisma.classMaterial.count({
      where: {
        classId,
        OR: [
          { uploadedAt: { gt: cls.topicMapUpdatedAt } },
          { processedAt: { gt: cls.topicMapUpdatedAt } },
        ],
      },
    });
    if (newer === 0) return cached;
  }

  const topics = await generateTopicMap(classId);
  await prisma.class.update({
    where: { id: classId },
    data: { topicMap: topics as unknown as object, topicMapUpdatedAt: new Date() },
  });
  return topics;
}
