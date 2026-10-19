import { type NextRequest } from "next/server";
import { ok, fail, handle, clientIp } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerFromProfile, signUpStudent } from "@/lib/services/students";

export const runtime = "nodejs";

/**
 * Student sign-up: details + credentials, no event needed.
 * If `eventId` is given (came from an event's Register button), also registers for it.
 */
export const POST = handle("student-signup", async (req: NextRequest) => {
  const allowed = await checkRateLimit("studentSignup", clientIp(req), true);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes and try again.");

  const body = (await req.json()) as Record<string, unknown>;
  const result = await signUpStudent(body);
  if (!result.ok) {
    switch (result.code) {
      case "VALIDATION_ERROR":
        return fail(422, result.code, "Please check the highlighted fields.", result.fields);
      case "EMAIL_TAKEN":
        return fail(409, result.code, "That email already has an account. Sign in instead.", { email: ["Already has an account — sign in instead"] });
      case "NOT_MIGRATED":
        return fail(503, result.code, "Student sign-up isn't enabled yet: run database migration 20261019000005.");
      default:
        return fail(500, result.code, "Couldn't create your account. Please try again.");
    }
  }

  // Optional: register for the event the student came from. Failure here doesn't undo the account.
  let registration: { ok: boolean; referenceCode?: string; message?: string } | null = null;
  const eventId = typeof body.eventId === "string" && /^[0-9a-f-]{36}$/i.test(body.eventId) ? body.eventId : null;
  if (eventId) {
    const r = await registerFromProfile(result.profileId, typeof body.email === "string" ? body.email.trim().toLowerCase() : null, eventId);
    registration = r.ok ? { ok: true, referenceCode: r.referenceCode } : { ok: false, message: r.message };
  }
  return ok({ created: true, registration }, 201);
});
