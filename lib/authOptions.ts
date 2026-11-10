import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import GoogleProvider from "next-auth/providers/google";
import { Role } from "@prisma/client";
import { JWT } from "next-auth/jwt";
import { Session, User, NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";

type UserWithRole = User & {
  role?: Role;
}

export const authOptions: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" as const },
  adapter: PrismaAdapter(prisma) as Adapter,
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID! as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
    }),
  ],
  pages: {
    signIn: '/sign-in',
    error: '/unauthorized',
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: UserWithRole }) {
      if (user) {
        token.role = user.role;
        token.id = user.id!;
      }
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser?.role && token.role !== dbUser.role) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        (session.user as UserWithRole).role = token.role as Role;
        session.user.id = token.id as string
      }
      return session;
    },
  },
};