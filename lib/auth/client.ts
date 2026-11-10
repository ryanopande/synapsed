"use client";
// Client-side auth for React components. Wraps next-auth/react so the rest of
// the app does not import it directly.
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { SIGN_IN_PATH } from "./routes";
import "./types";

export { SessionProvider, signIn, signOut, useSession };
export { CHOOSE_ROLE_PATH, HOME_BY_ROLE, SIGN_IN_PATH, UNAUTHORIZED_PATH } from "./routes";

export function signInWithGoogle() {
  return signIn("google");
}

/** Signs out and returns to the sign-in page. */
export function signOutToSignIn() {
  return signOut({ callbackUrl: SIGN_IN_PATH });
}

/** The signed-in user from the session, or undefined while loading/signed out. */
export function useCurrentUser() {
  const { data, status } = useSession();
  return { user: data?.user, status };
}
