// Attach the AI Literacy syllabus (study/data/syllabus/syllabus.json) to the study class,
// straight into the database: nothing is uploaded to cloud storage or the search index.
// Builds the same fields the app reads when generating pathways (mirrors study/lib/syllabus_context.py).
//   node --env-file=.env study/study1_instructor/attach_syllabus.mjs <classId>
// Safe to re-run: it replaces only the syllabus row this script created.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const classId = process.argv[2];
if (!classId) { console.error("usage: attach_syllabus.mjs <classId>"); process.exit(1); }
const prisma = new PrismaClient();
const TITLE = "AI Literacy syllabus (Study 1)";

const syl = JSON.parse(fs.readFileSync(new URL("../data/syllabus/syllabus.json", import.meta.url), "utf8"));
const lessonTitles = (ls = []) => ls.map((l) => (typeof l === "object" ? l.title : String(l)));
const schedule = (syl.blocks || []).map((b) => {
  const note = b.pathwayNote ? ` [${b.pathwayNote}]` : "";
  return `Week ${b.calendarWeek ?? "?"} — ${b.title} (${b.estimatedMinutes ?? 0} min): ${lessonTitles(b.lessons).join("; ")}${note}`;
}).join("\n");

const ctx = {
  courseDescription: syl.courseDescription || `${syl.courseTitle}. ${syl.scheduleWeeks ?? 2}-week asynchronous micro-course (~${syl.estimatedTotalMinutes ?? 0} minutes total).`,
  prerequisites: syl.prerequisites || "",
  learningObjectives: (syl.learningObjectives || []).map((o) => `- ${o}`).join("\n"),
  courseSchedule: schedule,
  assessmentMethods: syl.assessmentMethods || "Module quizzes and platform-based interaction across 2 calendar weeks. Blocks 5a (Business) and 5b (Projects) are pathway emphasis areas — personalized paths typically prioritize one over the other.",
};

try {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, title: true } });
  if (!cls) throw new Error(`No class with id ${classId} in this database.`);
  await prisma.classMaterial.deleteMany({ where: { classId, category: "SYLLABUS", title: TITLE } });
  await prisma.classMaterial.create({
    data: { classId, title: TITLE, url: "local://study/syllabus.json", type: "PDF", category: "SYLLABUS", syllabusProcessed: true, processedAt: new Date(), processingConfidence: 100, ...ctx },
  });
  console.log(`syllabus attached to class "${cls.title}" (${(syl.blocks || []).length} blocks, ${ctx.learningObjectives.split("\n").length} objectives)`);
} catch (e) {
  console.error(String(e.message || e)); process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
