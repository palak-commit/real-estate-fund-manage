import { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionToken, checkCredentials } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password || !checkCredentials(username, password)) {
    return fail("Invalid username or password", 401);
  }

  const res = ok(null, "Logged in");
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
