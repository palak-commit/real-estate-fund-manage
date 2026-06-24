import { SESSION_COOKIE } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST() {
  const res = ok(null, "Logged out");
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
