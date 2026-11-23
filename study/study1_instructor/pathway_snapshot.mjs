// Freeze and restore the pathways of one class so every participant starts from
// the same AI output. Run from the repo root (needs DATABASE_URL in .env):
//   node --env-file=.env study/study1_instructor/pathway_snapshot.mjs export <classId> [out.json]
//   node --env-file=.env study/study1_instructor/pathway_snapshot.mjs restore <classId> <snapshot.json>
// "export" also keeps a dated copy, so after a session you can export again to
// keep what the professor changed (regeneration deletes the old pathway).
// "restore" deletes ALL pathways in <classId>, then recreates them from the file
// with status "pending" (version, notes and timestamps reset). Explanations (rationale, evidence,
// rationaleSummary) and instructor edits (position, added/edited flags) are kept; export also saves the edit log.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();
const [cmd, classId, file] = process.argv.slice(2);

async function exportClass() {
  const pathways = await prisma.learningPathway.findMany({
    where: { classId },
    include: { nodes: { orderBy: { createdAt: "asc" } } },
  });
  const students = await prisma.user.findMany({
    where: { id: { in: pathways.map((p) => p.studentId) } },
    select: { id: true, email: true, name: true },
  });
  // What instructors changed (edit log), kept for the study record. restore ignores it.
  const editLogs = await prisma.pathwayEditLog.findMany({ where: { classId }, orderBy: { createdAt: "asc" } });
  const snap = { classId, exportedAt: new Date().toISOString(), students, pathways, editLogs };
  const out = file || `snapshot_${classId}_${Date.now()}.json`;
  fs.writeFileSync(out, JSON.stringify(snap, null, 2));
  console.log(`exported ${pathways.length} pathways -> ${out}`);
}

async function restoreClass() {
  if (!file) throw new Error("restore needs a snapshot file");
  const snap = JSON.parse(fs.readFileSync(file, "utf8"));
  // Same-class restore by default; across classes, students are matched by email.
  const emailById = Object.fromEntries(snap.students.map((s) => [s.id, s.email]));
  const users = await prisma.user.findMany({
    where: { email: { in: snap.students.map((s) => s.email) } },
    select: { id: true, email: true },
  });
  const idByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
  await prisma.learningPathway.deleteMany({ where: { classId } });
  for (const p of snap.pathways) {
    const studentId = idByEmail[emailById[p.studentId]] ?? p.studentId;
    const created = await prisma.learningPathway.create({
      data: {
        studentId, classId, surveyId: snap.classId === classId ? p.surveyId ?? null : null, status: "pending",
        // keep the instructor-facing explanation (added with the "why this node" feature)
        rationaleSummary: p.rationaleSummary ?? null,
      },
    });
    for (const n of p.nodes) {
      await prisma.pathwayNode.create({
        data: {
          pathwayId: created.id, nodeId: n.nodeId, title: n.title, description: n.description,
          type: n.type, difficulty: n.difficulty, duration: n.duration, dependsOn: n.dependsOn,
          rationale: n.rationale ?? null,
          ...(n.evidence != null ? { evidence: n.evidence } : {}),
          position: n.position ?? null,
          addedByInstructor: n.addedByInstructor ?? null,
          editedByInstructor: n.editedByInstructor ?? null,
        },
      });
    }
  }
  console.log(`restored ${snap.pathways.length} pathways into class ${classId}`);
}

try {
  if (!classId || !["export", "restore"].includes(cmd)) {
    console.log("usage: export <classId> [out.json] | restore <classId> <snapshot.json>");
    process.exitCode = 1;
  } else if (cmd === "export") await exportClass();
  else await restoreClass();
} finally {
  await prisma.$disconnect();
}
