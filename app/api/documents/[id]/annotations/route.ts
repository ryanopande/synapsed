import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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
