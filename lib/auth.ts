// Single-admin auth. Credentials live in env; the session cookie holds a SIGNED, EXPIRING
// token — `issuedAt.nonce.hmac` — so each login is unique, can't be forged without
// AUTH_SECRET, and stops being accepted after SESSION_TTL. Uses Web Crypto so the same code
// runs in edge middleware and Node route handlers.

export const SESSION_COOKIE = "re_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const IS_PROD = process.env.NODE_ENV === "production";
const FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

// Fail closed in production if the signing secret is missing — never sign sessions
// with the public dev fallback.
function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (IS_PROD) throw new Error("AUTH_SECRET is not configured");
  return FALLBACK_SECRET;
}

/** Whether the deployment has the credentials + secret required to log anyone in. */
export function isAuthConfigured(): boolean {
  return !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && (process.env.AUTH_SECRET || !IS_PROD));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Length-independent constant-time-ish compare (avoids leaking equality via early exit).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

/** A fresh signed session token: `issuedAt.nonce.hmac`. Set as the cookie on login. */
export async function sessionToken(): Promise<string> {
  const iat = Date.now().toString(36);
  const nonce = randomHex(16);
  const sig = await hmacHex(`${iat}.${nonce}`);
  return `${iat}.${nonce}.${sig}`;
}

/** True if the cookie is a valid, unexpired, correctly-signed session token. */
export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [iatStr, nonce, sig] = parts;
  const expected = await hmacHex(`${iatStr}.${nonce}`);
  if (!safeEqual(sig, expected)) return false;
  const iat = parseInt(iatStr, 36);
  if (!Number.isFinite(iat)) return false;
  const ageSeconds = (Date.now() - iat) / 1000;
  return ageSeconds >= 0 && ageSeconds <= SESSION_TTL_SECONDS;
}

/** Constant-time credential check. No fallback defaults — unset env means no login. */
export function checkCredentials(username: string, password: string): boolean {
  const U = process.env.ADMIN_USERNAME;
  const P = process.env.ADMIN_PASSWORD;
  if (!U || !P) return false;
  // Evaluate both comparisons so timing doesn't reveal which field was wrong.
  const okUser = safeEqual(username, U);
  const okPass = safeEqual(password, P);
  return okUser && okPass;
}
