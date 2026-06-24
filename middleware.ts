import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

// Paths reachable without a session.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const valid = await isValidSession(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (isPublic) {
    // Already signed in → skip the login page.
    if (pathname === "/login" && valid) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!valid) {
    // APIs get a clean 401; pages redirect to the login screen.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
