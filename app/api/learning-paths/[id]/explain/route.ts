import { NextRequest, NextResponse } from "next/server";
import { explainPathway } from "@/lib/learning-paths/explanations";

// POST /api/learning-paths/[id]/explain
// (Re)generates the instructor-facing "why this node" explanations for an existing pathway
// without changing its nodes. Useful for pathways generated before explanations existed.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await explainPathway(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
