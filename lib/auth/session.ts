// Server-side helpers for reading the signed-in user and rejecting requests
// that are not signed in or lack the right role.
//
// Each require* helper returns either `{ ok: true, user }` or
// `{ ok: false, response }`, so API routes can stay inside their existing
// try/catch blocks:
//
//   const authResult = await requireRole("PROFESSOR");
//   if (!authResult.ok) return authResult.response;
//   const { user } = authResult;
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "./nextauth";

export type AuthUser = {
  id: string;
  role: Role | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export type AuthResult<T = object> =
  | ({ ok: true; user: AuthUser } & T)
  | { ok: false; response: NextResponse };

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

/** Rejects with 401 unless someone is signed in. */
export async function requireUser(): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, user };
}

/** Rejects with 401/403 unless the user has one of `roles`. ADMIN always passes. */
export async function requireRole(...roles: Role[]): Promise<AuthResult> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (!hasRole(result.user, ...roles)) return { ok: false, response: forbidden() };
  return result;
}

export function hasRole(user: AuthUser, ...roles: Role[]): boolean {
  return user.role === "ADMIN" || (user.role !== null && roles.includes(user.role));
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN";
}
