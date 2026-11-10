// Ownership and membership checks for classes, surveys and pathway nodes. Built on
// session.ts; each guard returns the same `{ ok, ... }` shape.
import type { Class, LearningPathway, PathwayNode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  type AuthResult,
  type AuthUser,
  forbidden,
  isAdmin,
  notFound,
  requireUser,
} from "./session";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** The user teaches this class (or is an admin). */
export async function requireClassProfessor(classId: string): Promise<AuthResult<{ cls: Class }>> {
  const result = await requireUser();
  if (!result.ok) return result;
  const { user } = result;

  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return { ok: false, response: notFound("Class not found") };
  if (cls.professorId !== user.id && !isAdmin(user)) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, user, cls };
}

/** The user is enrolled in this class as a student (or is an admin). */
export async function requireEnrolledStudent(classId: string): Promise<AuthResult> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (!(await isEnrolled(result.user.id, classId)) && !isAdmin(result.user)) {
    return { ok: false, response: forbidden("Not enrolled in this class") };
  }
  return result;
}

/** The user teaches this class or is enrolled in it (or is an admin). */
export async function requireClassMember(
  classId: string,
): Promise<AuthResult<{ isProfessor: boolean }>> {
  const result = await requireUser();
  if (!result.ok) return result;
  const { user } = result;

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { professorId: true },
  });
  if (!cls) return { ok: false, response: notFound("Class not found") };

  const isProfessor = cls.professorId === user.id || isAdmin(user);
  if (!isProfessor && !(await isEnrolled(user.id, classId))) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, user, isProfessor };
}

/**
 * The user may act on `studentId`'s data in this class: either they are that
 * student, or they teach the class (or are an admin).
 */
export async function requireStudentOrClassProfessor(
  classId: string,
  studentId: string,
): Promise<AuthResult> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (result.user.id === studentId) return result;
  return requireClassProfessor(classId);
}

/** The user teaches the class this survey belongs to (or is an admin). */
export async function requireSurveyProfessor(
  surveyId: string,
): Promise<AuthResult<{ cls: Class }>> {
  const survey = OBJECT_ID.test(surveyId)
    ? await prisma.survey.findUnique({ where: { id: surveyId }, select: { classId: true } })
    : null;
  if (!survey) {
    const result = await requireUser();
    return result.ok ? { ok: false, response: notFound("Survey not found") } : result;
  }
  return requireClassProfessor(survey.classId);
}

/**
 * The pathway node belongs to the user's own pathway, or the user teaches
 * that pathway's class (or is an admin).
 */
export async function requirePathwayNodeAccess(
  nodeId: string,
): Promise<AuthResult<{ node: PathwayNode & { pathway: LearningPathway } }>> {
  const result = await requireUser();
  if (!result.ok) return result;
  const { user } = result;

  const node = OBJECT_ID.test(nodeId)
    ? await prisma.pathwayNode.findUnique({ where: { id: nodeId }, include: { pathway: true } })
    : null;
  if (!node) return { ok: false, response: notFound("Lesson not found") };

  if (node.pathway.studentId !== user.id && !isAdmin(user)) {
    const professorResult = await requireClassProfessor(node.pathway.classId);
    if (!professorResult.ok) return { ok: false, response: forbidden() };
  }
  return { ok: true, user, node };
}

export async function isEnrolled(studentId: string, classId: string): Promise<boolean> {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { studentId, classId },
    select: { id: true },
  });
  return !!enrollment;
}

export type { AuthUser };
