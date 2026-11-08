import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ok, fail, handle, clientIp } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { studentDetailsSchema } from "@/lib/schemas";
import { PENDING_SIGNUP_COOKIE, pendingCookieOptions, sealPendingSignup } from "@/lib/auth/pending-signup";

export const runtime = "nodejs";

/**
 * Student sign-up, step 1: validate the student's details and hold them (sealed, httpOnly cookie)
 * while the browser goes to Google. `/auth/callback` saves them to the new account.
 * If `eventId` is given (came from an event's Register button), the callback also registers for it.
 */
export const POST = handle("student-signup", async (req: NextRequest) => {
  const allowed = await checkRateLimit("studentSignup", clientIp(req), true);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes and try again.");

  const body = (await req.json()) as Record<string, unknown>;
  const parsed = studentDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return fail(422, "VALIDATION_ERROR", "Please check the highlighted fields.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  const eventId = typeof body.eventId === "string" && /^[0-9a-f-]{36}$/i.test(body.eventId) ? body.eventId : null;

  (await cookies()).set(PENDING_SIGNUP_COOKIE, sealPendingSignup({ details: parsed.data, eventId }), pendingCookieOptions);
  return ok({ pending: true });
});
