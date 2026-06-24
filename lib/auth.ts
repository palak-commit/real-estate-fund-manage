// Minimal single-admin auth. Credentials live in env; the session cookie holds an
// HMAC token (not the raw secret) so it can't be forged without AUTH_SECRET.
// Uses Web Crypto so the same code runs in edge middleware and Node route handlers.

export const SESSION_COOKIE = "re_session";

const FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Deterministic session token derived from AUTH_SECRET. Set as the cookie on login. */
export async function sessionToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET || FALLBACK_SECRET;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("admin-session-v1"));
  return toHex(sig);
}

/** True if the cookie value matches the expected session token. */
export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  return cookieValue === (await sessionToken());
}

export function checkCredentials(username: string, password: string): boolean {
  const U = process.env.ADMIN_USERNAME || "admin";
  const P = process.env.ADMIN_PASSWORD || "admin123";
  return username === U && password === P;
}
