import { NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, sessionToken, checkCredentials, isAuthConfigured } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

// Simple in-memory brute-force guard: lock an IP after too many failures for a window.
// Per-instance (fine for a single-admin self-host); resets on a successful login.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; until: number }>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : "").trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return fail("Server auth is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD and AUTH_SECRET.", 500);
  }

  const ip = clientIp(req);
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now && rec.count >= MAX_FAILURES) {
    const mins = Math.ceil((rec.until - now) / 60000);
    return fail(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, 429);
  }

  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password || !checkCredentials(username, password)) {
    const cur = attempts.get(ip);
    attempts.set(ip, { count: cur && cur.until > now ? cur.count + 1 : 1, until: now + WINDOW_MS });
    return fail("Invalid username or password", 401);
  }

  attempts.delete(ip); // successful login clears the counter
  const res = ok(null, "Logged in");
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
