import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const classId = id;

  try {
    const materials = await prisma.classMaterial.findMany({
      where: { classId: new ObjectId(classId).toString() },
      orderBy: { uploadedAt: 'desc' },
    });
    //console.log("here is the mat",materials)

    return NextResponse.json(materials);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
