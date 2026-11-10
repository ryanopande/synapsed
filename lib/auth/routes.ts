// Page paths and role-based page access rules. Kept free of server-only
// imports (Prisma, NextAuth) so middleware can use it on the edge runtime.
import type { Role } from "@prisma/client";

export const SIGN_IN_PATH = "/sign-in";
export const CHOOSE_ROLE_PATH = "/choose-role";
export const UNAUTHORIZED_PATH = "/unauthorized";

/** Where each role lands after signing in. */
export const HOME_BY_ROLE: Record<Role, string> = {
  STUDENT: "/student/dashboard",
  PROFESSOR: "/teacher/dashboard",
  ADMIN: "/teacher/dashboard",
};

/** Pages reachable without signing in (or without a role yet). */
export const PUBLIC_PAGES = [SIGN_IN_PATH, CHOOSE_ROLE_PATH];

/** Page prefixes and the roles allowed on them. ADMIN is always allowed. */
export const PAGE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/class", roles: ["PROFESSOR", "STUDENT"] },
  { prefix: "/teacher", roles: ["PROFESSOR"] },
  { prefix: "/student", roles: ["STUDENT"] },
];

export function canAccessPage(pathname: string, role: Role): boolean {
  if (role === "ADMIN") return true;
  const rule = PAGE_ACCESS.find(({ prefix }) => pathname.startsWith(prefix));
  return !rule || rule.roles.includes(role);
}
