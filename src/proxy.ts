import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie means "send to sign-in". Pages and
// API routes still verify the session themselves (lib/auth/session.ts), since
// a cookie can be stale or forged.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/account/:path*", "/weddings/:path*"],
};
