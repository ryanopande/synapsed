import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    
    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    // Get all processed syllabus materials for this class
    const syllabusMaterials = await prisma.classMaterial.findMany({
      where: {
        classId,
        category: "SYLLABUS",
        syllabusProcessed: true,
      },
      orderBy: { processedAt: 'desc' },
    });

    if (syllabusMaterials.length === 0) {
      return NextResponse.json({ 
        error: "No processed syllabus found for this class",
        hasSyllabus: false 
      }, { status: 404 });
    }

    // Combine all syllabus content
    const combinedContent = {
      learningObjectives: syllabusMaterials
        .map(m => m.learningObjectives)
        .filter(Boolean)
        .join('\n\n'),
      courseSchedule: syllabusMaterials
        .map(m => m.courseSchedule)
        .filter(Boolean)
        .join('\n\n'),
      assessmentMethods: syllabusMaterials
        .map(m => m.assessmentMethods)
        .filter(Boolean)
        .join('\n\n'),
      prerequisites: syllabusMaterials
        .map(m => m.prerequisites)
        .filter(Boolean)
        .join('\n\n'),
      courseDescription: syllabusMaterials
        .map(m => m.courseDescription)
        .filter(Boolean)
        .join('\n\n'),
      instructorInfo: syllabusMaterials
        .map(m => m.instructorInfo)
        .filter(Boolean)
        .join('\n\n'),
      gradingPolicy: syllabusMaterials
        .map(m => m.gradingPolicy)
        .filter(Boolean)
        .join('\n\n'),
      extractedText: syllabusMaterials
        .map(m => m.extractedText)
        .filter(Boolean)
        .join('\n\n'),
      processedAt: syllabusMaterials[0].processedAt,
      materialCount: syllabusMaterials.length,
      averageConfidence: syllabusMaterials
        .map(m => m.processingConfidence)
        .filter((conf): conf is number => conf !== null)
        .reduce((sum, conf) => sum + conf, 0) / syllabusMaterials.length || 0,
    };

    return NextResponse.json({
      success: true,
      hasSyllabus: true,
      content: combinedContent,
      materials: syllabusMaterials.map(m => ({
        id: m.id,
        title: m.title,
        processedAt: m.processedAt,
      })),
    });

  } catch (error) {
    console.error("Syllabus content retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve syllabus content" },
      { status: 500 }
    );
  }
}

// POST endpoint to trigger processing of unprocessed syllabus files
export async function POST(req: Request) {
  try {
    const { classId } = await req.json();
    
    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    // Find unprocessed syllabus materials
    const unprocessedMaterials = await prisma.classMaterial.findMany({
      where: {
        classId,
        category: "SYLLABUS",
        syllabusProcessed: false,
        type: { in: ["PDF", "DOCX"] },
      },
    });

    if (unprocessedMaterials.length === 0) {
      return NextResponse.json({ 
        message: "No unprocessed syllabus materials found",
        processed: 0 
      });
    }

    // Process each unprocessed material
    const results = [];
    for (const material of unprocessedMaterials) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/syllabus/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materialId: material.id }),
        });
        
        if (response.ok) {
          results.push({ id: material.id, title: material.title, success: true });
        } else {
          results.push({ id: material.id, title: material.title, success: false, error: await response.text() });
        }
      } catch (error) {
        results.push({ id: material.id, title: material.title, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.filter(r => r.success).length,
      total: results.length,
      results,
    });

  } catch (error) {
    console.error("Syllabus processing trigger error:", error);
    return NextResponse.json(
      { error: "Failed to trigger syllabus processing" },
      { status: 500 }
    );
  }
}
