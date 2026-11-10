// NextAuth configuration: Google sign-in, Prisma-backed users, JWT sessions
// that carry the user's id and role.
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/db/prisma";
import { SIGN_IN_PATH, UNAUTHORIZED_PATH } from "./routes";

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  adapter: PrismaAdapter(prisma) as Adapter,
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: SIGN_IN_PATH,
    error: UNAUTHORIZED_PATH,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? null;
        token.id = user.id!;
      }
      // Pick up role changes (e.g. after /choose-role) without a re-login.
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser?.role && token.role !== dbUser.role) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role ?? null;
        session.user.id = token.id;
      }
      return session;
    },
  },
};
