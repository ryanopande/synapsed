import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: { id, uploadedBy: user.id },
      select: { id: true },
    });
    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    // Delete all content references for the document (cascade deletes notes)
    await prisma.contentReference.deleteMany({
      where: { documentId: id }
    });

    return NextResponse.json({ message: "Document annotations cleared successfully" });
  } catch (err) {
    console.error("[CLEAR_DOCUMENT_ANNOTATIONS]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
