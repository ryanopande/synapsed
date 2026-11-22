import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  EditError,
  applyPathwayEdit,
  listEditHistory,
  loadPathwayView,
  undoLastEdit,
} from "@/lib/learning-paths/pathwayEditService";
import type { EditAction } from "@/lib/learning-paths/pathwayEditing";

// GET  /api/learning-paths/[id]/edit  -> the edit history of a pathway (and whether Undo is possible)
// POST /api/learning-paths/[id]/edit  -> apply one edit: update | add | remove | move | undo
//
// Only the professor who owns the class (or an admin) may use it. Editing sends the pathway back to
// "pending" so the instructor re-approves it, and it is refused once the student has started it.

async function authorize(pathwayId: string): Promise<{ userId: string } | { response: NextResponse }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };

  const pathway = await prisma.learningPathway.findUnique({ where: { id: pathwayId }, select: { classId: true } });
  if (!pathway) return { response: NextResponse.json({ message: "Pathway not found" }, { status: 404 }) };

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    const cls = await prisma.class.findUnique({ where: { id: pathway.classId }, select: { professorId: true } });
    if (role !== "PROFESSOR" || cls?.professorId !== userId) {
      return { response: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
  }
  return { userId };
}

function parseEdit(body: unknown): EditAction | null {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (b.action) {
    case "update":
      return typeof b.nodeId === "string" && b.fields && typeof b.fields === "object"
        ? { action: "update", nodeId: b.nodeId, fields: b.fields as Record<string, string> }
        : null;
    case "add":
      return b.node && typeof b.node === "object" && (b.afterNodeId === null || typeof b.afterNodeId === "string")
        ? { action: "add", node: b.node as { title: string }, afterNodeId: b.afterNodeId as string | null }
        : null;
    case "remove":
      return typeof b.nodeId === "string" ? { action: "remove", nodeId: b.nodeId } : null;
    case "move":
      return typeof b.nodeId === "string" && typeof b.toIndex === "number"
        ? { action: "move", nodeId: b.nodeId, toIndex: b.toIndex }
        : null;
    default:
      return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorize(id);
  if ("response" in authz) return authz.response;
  return NextResponse.json(await listEditHistory(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorize(id);
  if ("response" in authz) return authz.response;

  try {
    const body = await req.json().catch(() => null);
    let summary: string;
    if ((body as { action?: string } | null)?.action === "undo") {
      summary = (await undoLastEdit({ pathwayId: id, userId: authz.userId })).summary;
    } else {
      const edit = parseEdit(body);
      if (!edit) return NextResponse.json({ message: "That edit request isn't valid." }, { status: 400 });
      summary = (await applyPathwayEdit({ pathwayId: id, edit, userId: authz.userId })).summary;
    }
    const [pathway, history] = await Promise.all([loadPathwayView(id), listEditHistory(id)]);
    return NextResponse.json({ success: true, summary, pathway, canUndo: history.canUndo });
  } catch (error) {
    if (error instanceof EditError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[EDIT_PATHWAY]", error);
    return NextResponse.json({ message: "Failed to edit the pathway." }, { status: 500 });
  }
}
