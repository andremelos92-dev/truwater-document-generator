import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Every page, API and template needs a signed-in session, except the login page ("/") and the login API.
 * Pages send you to the login page (and back afterwards); APIs answer 401.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/") {
    return session ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }
  if (session || pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const login = new URL("/", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Next's own files and the logo shown on the login page stay public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|truwater-logo.png).*)"],
};
