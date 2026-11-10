// The NextAuth instance. Re-exported from "@/lib/auth".
import NextAuth from "next-auth";
import "./types";
import { authConfig } from "./config";

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
