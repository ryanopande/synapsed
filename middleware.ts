// Page-level access control. Sends signed-out visitors to sign-in, users
// without a role to choose-role, and wrong-role users to /unauthorized.
// API routes check auth themselves via "@/lib/auth".
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  CHOOSE_ROLE_PATH,
  PUBLIC_PAGES,
  SIGN_IN_PATH,
  UNAUTHORIZED_PATH,
  canAccessPage,
} from "@/lib/auth/routes";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    // Remember where the user was going (e.g. a class invite link) so sign-in can return there.
    const signInUrl = new URL(SIGN_IN_PATH, req.url);
    signInUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  if (!token.role) {
    return NextResponse.redirect(new URL(CHOOSE_ROLE_PATH, req.url));
  }

  if (!canAccessPage(pathname, token.role)) {
    return NextResponse.redirect(new URL(UNAUTHORIZED_PATH, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/student/:path*", "/class/:path*"],
};
