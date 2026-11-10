// Adds the user's id and role to NextAuth's session, user and JWT types so
// callers can read `session.user.role` without casting.
import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: Role | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: Role | null;
  }
}
