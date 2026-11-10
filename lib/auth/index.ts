// The authentication parent module. Server code imports from "@/lib/auth";
// client components import from "@/lib/auth/client"; middleware imports
// "@/lib/auth/routes".
//
//   config.ts       NextAuth providers and callbacks
//   nextauth.ts     the NextAuth instance (auth, handlers, signIn, signOut)
//   session.ts      getCurrentUser / requireUser / requireRole
//   guards.ts       class and quiz ownership checks
//   service-key.ts  STUDY_API_KEY access for the study/ pipeline
//   routes.ts       page paths and role-based page access (edge-safe)
//   client.ts       useSession / signIn / signOut for client components
export { auth, handlers, signIn, signOut } from "./nextauth";

export * from "./session";
export * from "./guards";
export * from "./service-key";
export * from "./routes";
