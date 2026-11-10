import { prisma } from "@/lib/prisma";

export interface SyllabusContext {
  courseName: string;
  courseDescription: string;
  prerequisites: string;
  learningObjectives: string;
  assessmentMethods: string;
  courseSchedule: string;
  gradingPolicy: string;
  hasSyllabus: boolean;
  syllabusConfidence: number;
  materialCount: number;
}

export interface ClassInfo {
  id: string;
  title: string;
  description: string | null;
}

/**
 * Get class information by classId
 */
export async function getClassInfo(classId: string): Promise<ClassInfo | null> {
  try {
    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        title: true,
        description: true,
      },
    });

    return classInfo;
  } catch (error) {
    console.error("Error fetching class info:", error);
    return null;
  }
}

/**
 * Get comprehensive syllabus context for a class
 */
export async function getSyllabusContext(classId: string): Promise<SyllabusContext> {
  try {
    // Get class information
    const classInfo = await getClassInfo(classId);
    if (!classInfo) {
      throw new Error("Class not found");
    }

    // Get syllabus materials for this class
    const syllabusMaterials = await prisma.classMaterial.findMany({
      where: {
        classId: classId,
        category: "SYLLABUS",
        syllabusProcessed: true,
      },
      select: {
        learningObjectives: true,
        prerequisites: true,
        courseDescription: true,
        assessmentMethods: true,
        courseSchedule: true,
        gradingPolicy: true,
        processingConfidence: true,
      },
    });

    // If no syllabus data, return basic context
    if (syllabusMaterials.length === 0) {
      return {
        courseName: classInfo.title,
        courseDescription: classInfo.description || "No course description available",
        prerequisites: "No prerequisites specified",
        learningObjectives: "No learning objectives specified",
        assessmentMethods: "No assessment methods specified",
        courseSchedule: "No course schedule available",
        gradingPolicy: "No grading policy specified",
        hasSyllabus: false,
        syllabusConfidence: 0,
        materialCount: 0,
      };
    }

    // Combine all syllabus content
    const combinedContent = {
      learningObjectives: syllabusMaterials
        .map(m => m.learningObjectives)
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
      assessmentMethods: syllabusMaterials
        .map(m => m.assessmentMethods)
        .filter(Boolean)
        .join('\n\n'),
      courseSchedule: syllabusMaterials
        .map(m => m.courseSchedule)
        .filter(Boolean)
        .join('\n\n'),
      gradingPolicy: syllabusMaterials
        .map(m => m.gradingPolicy)
        .filter(Boolean)
        .join('\n\n'),
    };

    // Calculate average confidence
    const averageConfidence = syllabusMaterials
      .map(m => m.processingConfidence)
      .filter((conf): conf is number => conf !== null)
      .reduce((sum, conf) => sum + conf, 0) / syllabusMaterials.length || 0;

    return {
      courseName: classInfo.title,
      courseDescription: combinedContent.courseDescription || classInfo.description || "No course description available",
      prerequisites: combinedContent.prerequisites || "No prerequisites specified",
      learningObjectives: combinedContent.learningObjectives || "No learning objectives specified",
      assessmentMethods: combinedContent.assessmentMethods || "No assessment methods specified",
      courseSchedule: combinedContent.courseSchedule || "No course schedule available",
      gradingPolicy: combinedContent.gradingPolicy || "No grading policy specified",
      hasSyllabus: true,
      syllabusConfidence: Math.round(averageConfidence),
      materialCount: syllabusMaterials.length,
    };
  } catch (error) {
    console.error("Error fetching syllabus context:", error);
    
    // Return fallback context
    const classInfo = await getClassInfo(classId);
    return {
      courseName: classInfo?.title || "Unknown Course",
      courseDescription: classInfo?.description || "No course description available",
      prerequisites: "No prerequisites specified",
      learningObjectives: "No learning objectives specified",
      assessmentMethods: "No assessment methods specified",
      courseSchedule: "No course schedule available",
      gradingPolicy: "No grading policy specified",
      hasSyllabus: false,
      syllabusConfidence: 0,
      materialCount: 0,
    };
  }
}

/**
 * Check if a class has processed syllabus data
 */
export async function hasSyllabusData(classId: string): Promise<boolean> {
  try {
    const count = await prisma.classMaterial.count({
      where: {
        classId: classId,
        category: "SYLLABUS",
        syllabusProcessed: true,
      },
    });
    return count > 0;
  } catch (error) {
    console.error("Error checking syllabus data:", error);
    return false;
  }
}

/**
 * Get syllabus data quality metrics
 */
export async function getSyllabusQuality(classId: string): Promise<{
  hasData: boolean;
  confidence: number;
  completeness: number;
  materialCount: number;
}> {
  try {
    const materials = await prisma.classMaterial.findMany({
      where: {
        classId: classId,
        category: "SYLLABUS",
        syllabusProcessed: true,
      },
      select: {
        learningObjectives: true,
        prerequisites: true,
        courseDescription: true,
        assessmentMethods: true,
        processingConfidence: true,
      },
    });

    if (materials.length === 0) {
      return {
        hasData: false,
        confidence: 0,
        completeness: 0,
        materialCount: 0,
      };
    }

    // Calculate completeness based on filled fields
    const totalFields = materials.length * 4; // 4 main fields per material
    const filledFields = materials.reduce((count, material) => {
      let filled = 0;
      if (material.learningObjectives) filled++;
      if (material.prerequisites) filled++;
      if (material.courseDescription) filled++;
      if (material.assessmentMethods) filled++;
      return count + filled;
    }, 0);

    const completeness = Math.round((filledFields / totalFields) * 100);
    const confidence = Math.round(
      materials
        .map(m => m.processingConfidence)
        .filter((conf): conf is number => conf !== null)
        .reduce((sum, conf) => sum + conf, 0) / materials.length || 0
    );

    return {
      hasData: true,
      confidence,
      completeness,
      materialCount: materials.length,
    };
  } catch (error) {
    console.error("Error getting syllabus quality:", error);
    return {
      hasData: false,
      confidence: 0,
      completeness: 0,
      materialCount: 0,
    };
  }
}
