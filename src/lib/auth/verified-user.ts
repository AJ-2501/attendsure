import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Hand-off from the proxy to the render: the proxy already verifies the session with
 * Supabase Auth (getUser) on every request, so it forwards the verified user on an internal
 * request header and getSessionProfile() skips a second remote verification.
 *
 * The header is HMAC-signed with a server-only secret and short-lived, and the proxy strips
 * any client-supplied copy, so it cannot be forged from outside. Without a valid header the
 * session falls back to verifying with Supabase Auth itself.
 */
export const VERIFIED_USER_HEADER = "x-attendsure-verified-user";

export type VerifiedUser = { id: string; email: string | null };

/** Covers one request's render, including slow server actions; never reused across requests. */
const MAX_AGE_MS = 60_000;

function key() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return k ? `attendsure:verified-user:v1:${k}` : null;
}

const sign = (payload: string, k: string) => createHmac("sha256", k).update(payload).digest("base64url");

export function signVerifiedUser(user: VerifiedUser): string | null {
  const k = key();
  if (!k) return null;
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload, k)}`;
}

export function readVerifiedUser(value: string | null | undefined): VerifiedUser | null {
  const k = key();
  if (!k || !value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, k));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { id, email, iat } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof id !== "string" || typeof iat !== "number" || Math.abs(Date.now() - iat) > MAX_AGE_MS) return null;
    return { id, email: typeof email === "string" ? email : null };
  } catch {
    return null;
  }
}
