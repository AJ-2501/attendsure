import "server-only";
import { tdesDecrypt, tdesEncrypt } from "@/lib/crypto/tdes";
import { studentDetailsSchema, type StudentDetails } from "@/lib/schemas";

/**
 * Details a student filled in before leaving for Google sign-in. They ride along in a short-lived,
 * httpOnly cookie, encrypted + MAC'd (tamper-proof), and are saved once the callback knows the account.
 */
export const PENDING_SIGNUP_COOKIE = "as_pending_signup";
export const PENDING_SIGNUP_TTL_SECONDS = 15 * 60;
const CONTEXT = "cookies.pending_signup";

export interface PendingSignup {
  details: StudentDetails;
  eventId: string | null;
}

export function sealPendingSignup(p: PendingSignup): string {
  return tdesEncrypt(JSON.stringify({ ...p, exp: Date.now() + PENDING_SIGNUP_TTL_SECONDS * 1000 }), CONTEXT);
}

export function openPendingSignup(sealed: string | undefined): PendingSignup | null {
  if (!sealed) return null;
  try {
    const raw = JSON.parse(tdesDecrypt(sealed, CONTEXT)) as { details: unknown; eventId: unknown; exp: number };
    if (typeof raw.exp !== "number" || raw.exp < Date.now()) return null;
    const details = studentDetailsSchema.safeParse(raw.details);
    if (!details.success) return null;
    const eventId = typeof raw.eventId === "string" && /^[0-9a-f-]{36}$/i.test(raw.eventId) ? raw.eventId : null;
    return { details: details.data, eventId };
  } catch {
    return null;
  }
}

export const pendingCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: PENDING_SIGNUP_TTL_SECONDS,
};
