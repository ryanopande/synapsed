import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyEdit,
  orderNodes,
  validateNodes,
  type EditAction,
  type EditableNode,
} from "./pathwayEditing";

/**
 * Database side of instructor pathway editing. The rules live in pathwayEditing.ts.
 *
 * Every edit runs in one transaction that (1) re-checks the student has not started the
 * pathway, (2) applies the edit to the CURRENT nodes, (3) saves the result, (4) writes a
 * PathwayEditLog row holding the node list before and after, so any edit can be undone and
 * the study can report exactly what instructors changed.
 *
 * An edited pathway goes back to "pending" so the instructor re-approves what they changed.
 */

export class EditError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type DbNode = Prisma.PathwayNodeGetPayload<Record<string, never>>;
type Tx = Prisma.TransactionClient;

function toEditable(n: DbNode): EditableNode & { position: number | null } {
  return {
    id: n.id,
    nodeId: n.nodeId,
    title: n.title,
    description: n.description,
    type: n.type,
    difficulty: n.difficulty,
    duration: n.duration,
    dependsOn: n.dependsOn,
    rationale: n.rationale,
    evidence: n.evidence,
    addedByInstructor: n.addedByInstructor,
    editedByInstructor: n.editedByInstructor,
    position: n.position,
  };
}

/** Plain JSON copy of a node list for the edit log (database ids are not kept: nodeId is the identity). */
function snapshot(nodes: EditableNode[]): Prisma.InputJsonValue {
  return nodes.map((n) => ({
    nodeId: n.nodeId,
    title: n.title,
    description: n.description,
    type: n.type,
    difficulty: n.difficulty,
    duration: n.duration,
    dependsOn: n.dependsOn,
    rationale: n.rationale ?? null,
    evidence: (n.evidence ?? null) as Prisma.InputJsonValue | null,
    addedByInstructor: n.addedByInstructor ?? null,
    editedByInstructor: n.editedByInstructor ?? null,
  })) as unknown as Prisma.InputJsonValue;
}

async function assertStudentHasNotStarted(tx: Tx, pathwayId: string) {
  const nodes = await tx.pathwayNode.findMany({
    where: { pathwayId },
    select: {
      flashcardDeck: { select: { id: true } },
      _count: { select: { progress: true, lessonNotes: true, inChatAssessments: true } },
    },
  });
  const started = nodes.some(
    (n) =>
      n.flashcardDeck !== null ||
      n._count.progress > 0 ||
      n._count.lessonNotes > 0 ||
      n._count.inChatAssessments > 0
  );
  if (started) {
    throw new EditError(
      "The student has already started this pathway (progress, notes, flashcards or assessments exist), so it can't be edited without losing their work.",
      409
    );
  }
}

/** Make the stored nodes equal `desired` (matched by nodeId): delete, update, create. */
async function persistNodes(tx: Tx, pathwayId: string, existing: DbNode[], desired: EditableNode[]) {
  const problem = validateNodes(desired);
  if (problem) throw new EditError(problem, 400);

  const keep = new Set(desired.map((d) => d.nodeId));
  const toDelete = existing.filter((n) => !keep.has(n.nodeId));
  if (toDelete.length > 0) {
    await tx.pathwayNode.deleteMany({ where: { id: { in: toDelete.map((n) => n.id) } } });
  }

  const existingByNodeId = new Map(existing.map((n) => [n.nodeId, n]));
  for (let i = 0; i < desired.length; i++) {
    const d = desired[i];
    const common = {
      title: d.title,
      description: d.description,
      type: d.type,
      difficulty: d.difficulty,
      duration: d.duration,
      dependsOn: d.dependsOn,
      position: i,
      addedByInstructor: d.addedByInstructor ?? null,
      editedByInstructor: d.editedByInstructor ?? null,
    };
    const current = existingByNodeId.get(d.nodeId);
    if (current) {
      // rationale / evidence are never changed by an edit, so they are left as they are
      await tx.pathwayNode.update({ where: { id: current.id }, data: common });
    } else {
      await tx.pathwayNode.create({
        data: {
          pathwayId,
          nodeId: d.nodeId,
          ...common,
          ...(typeof d.rationale === "string" ? { rationale: d.rationale } : {}),
          ...(d.evidence != null ? { evidence: d.evidence as Prisma.InputJsonValue } : {}),
          flashcardsAdded: false,
          aiLessonComplete: false,
          quizScore: null,
        },
      });
    }
  }
}

async function reopenForReview(tx: Tx, pathwayId: string, status: string) {
  if (status === "pending") return;
  await tx.learningPathway.update({
    where: { id: pathwayId },
    data: { status: "pending", approvedAt: null, rejectedAt: null },
  });
}

export async function applyPathwayEdit(args: { pathwayId: string; edit: EditAction; userId?: string }) {
  const { pathwayId, edit, userId } = args;
  return prisma.$transaction(
    async (tx) => {
      const pathway = await tx.learningPathway.findUnique({ where: { id: pathwayId }, include: { nodes: true } });
      if (!pathway) throw new EditError("Pathway not found.", 404);
      await assertStudentHasNotStarted(tx, pathwayId);

      const before = orderNodes(pathway.nodes.map(toEditable));
      const result = applyEdit(before, edit);
      if (!result.ok) throw new EditError(result.error, 400);

      await persistNodes(tx, pathwayId, pathway.nodes, result.nodes);
      await reopenForReview(tx, pathwayId, pathway.status);
      await tx.pathwayEditLog.create({
        data: {
          pathwayId,
          classId: pathway.classId,
          studentId: pathway.studentId,
          editedBy: userId ?? null,
          action: edit.action,
          nodeId: result.nodeId ?? null,
          summary: result.summary,
          before: snapshot(before),
          after: snapshot(result.nodes),
        },
      });
      return { summary: result.summary };
    },
    { timeout: 20000 }
  );
}

/** Reverse the most recent edit that has not been undone. */
export async function undoLastEdit(args: { pathwayId: string; userId?: string }) {
  const { pathwayId, userId } = args;
  return prisma.$transaction(
    async (tx) => {
      const pathway = await tx.learningPathway.findUnique({ where: { id: pathwayId }, include: { nodes: true } });
      if (!pathway) throw new EditError("Pathway not found.", 404);
      await assertStudentHasNotStarted(tx, pathwayId);

      const last = await tx.pathwayEditLog.findFirst({
        where: { pathwayId, undone: false, action: { not: "undo" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (!last) throw new EditError("There is nothing to undo.", 400);

      const desired = last.before as unknown as EditableNode[];
      const current = orderNodes(pathway.nodes.map(toEditable));
      await persistNodes(tx, pathwayId, pathway.nodes, desired);
      await reopenForReview(tx, pathwayId, pathway.status);
      await tx.pathwayEditLog.update({ where: { id: last.id }, data: { undone: true } });
      await tx.pathwayEditLog.create({
        data: {
          pathwayId,
          classId: pathway.classId,
          studentId: pathway.studentId,
          editedBy: userId ?? null,
          action: "undo",
          nodeId: last.nodeId,
          summary: `Undid: ${last.summary}`,
          before: snapshot(current),
          after: snapshot(desired),
        },
      });
      return { summary: `Undid: ${last.summary}` };
    },
    { timeout: 20000 }
  );
}

export async function listEditHistory(pathwayId: string) {
  const rows = await prisma.pathwayEditLog.findMany({
    where: { pathwayId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, action: true, nodeId: true, summary: true, undone: true, createdAt: true },
  });
  return { entries: rows, canUndo: rows.some((r) => !r.undone && r.action !== "undo") };
}

/** The pathway as the professor screen shows it: nodes in learning order, with student info. */
export async function loadPathwayView(pathwayId: string) {
  const pathway = await prisma.learningPathway.findUnique({ where: { id: pathwayId }, include: { nodes: true } });
  if (!pathway) return null;
  const student = await prisma.user.findUnique({
    where: { id: pathway.studentId },
    select: { name: true, email: true },
  });
  const nodes = orderNodes(pathway.nodes);
  return {
    id: pathway.id,
    studentId: pathway.studentId,
    studentName: student?.name || "Unknown Student",
    studentEmail: student?.email || "",
    status: pathway.status,
    professorNotes: pathway.professorNotes,
    rationaleSummary: pathway.rationaleSummary,
    approvedAt: pathway.approvedAt,
    rejectedAt: pathway.rejectedAt,
    createdAt: pathway.createdAt,
    updatedAt: pathway.updatedAt,
    nodes: nodes.map((n) => ({
      id: n.id,
      nodeId: n.nodeId,
      title: n.title,
      description: n.description,
      type: n.type,
      difficulty: n.difficulty,
      duration: n.duration,
      dependsOn: n.dependsOn,
      rationale: n.rationale,
      evidence: n.evidence,
      position: n.position,
      addedByInstructor: n.addedByInstructor,
      editedByInstructor: n.editedByInstructor,
    })),
    nodeCount: nodes.length,
    classId: pathway.classId,
  };
}
