import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isStudyServiceRequest, requireClassProfessor } from "@/lib/auth";
import { extractSyllabus } from "@/lib/syllabus/extractSyllabus";

// POST { materialId, forceReprocess? }: extract and cache a syllabus material's content
export async function POST(req: Request) {
  try {
    const { materialId, forceReprocess = false } = await req.json();

    if (!materialId) {
      return NextResponse.json({ error: "Missing materialId" }, { status: 400 });
    }

    if (!isStudyServiceRequest(req)) {
      const material = await prisma.classMaterial.findUnique({
        where: { id: materialId },
        select: { classId: true },
      });
      if (!material) {
        return NextResponse.json({ error: "Material not found" }, { status: 404 });
      }
      const authResult = await requireClassProfessor(material.classId);
      if (!authResult.ok) return authResult.response;
    }

    const { status, body } = await extractSyllabus(materialId, { forceReprocess });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("Syllabus extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract syllabus content" },
      { status: 500 }
    );
  }
}
