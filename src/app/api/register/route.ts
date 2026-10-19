import { type NextRequest } from "next/server";
import { ok, fail, handle, clientIp } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerParticipant } from "@/lib/services/registrations";
import { createStudentUser, deleteStudentUser, getProfileDigest, linkRegistration, getStudentPrefill } from "@/lib/services/students";
import { getSessionProfile } from "@/lib/auth/session";
import { accountSchema, normalizeStudentId } from "@/lib/schemas";
import { studentIdDigest } from "@/lib/crypto/tokens";
import { listPublishedEvents } from "@/lib/services/events";
import { effectiveStatus, registrationPhase } from "@/lib/time";

export const runtime = "nodejs";

export const GET = handle("register", async () => {
  const now = new Date();
  // Only events that are accepting registrations right now (same rule the database enforces).
  const events = (await listPublishedEvents()).filter((e) => registrationPhase(e, now) === "open" && effectiveStatus(e, now) !== "completed");
  // Only return fields needed for the form (no sensitive internal state).
  const safe = events.map((e) => ({
    id: e.id,
    name: e.name,
    venue: e.venue,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    registration_opens_at: e.registration_opens_at,
    registration_closes_at: e.registration_closes_at,
    status: e.status,
    capacity: e.capacity,
    student_id_pattern: e.student_id_pattern,
    student_id_hint: e.student_id_hint,
    required_fields: e.required_fields,
    timezone: e.timezone,
  }));
  const session = await getSessionProfile();
  const me =
    session?.role === "student"
      ? { email: session.email, prefill: await getStudentPrefill(session.profileId) }
      : session
        ? { email: session.email, staff: true, prefill: null }
        : null;
  return ok({ events: safe, me });
});

const REGISTER_ERRORS: Record<string, [number, string]> = {
  DUPLICATE_REGISTRATION: [409, "This student ID is already registered for this event. Sign in to see your QR pass."],
  EVENT_NOT_AVAILABLE: [400, "This event is not accepting registrations."],
  REGISTRATION_CLOSED: [400, "Registration for this event is closed."],
  EVENT_FULL: [409, "This event has reached its maximum capacity."],
};

/**
 * Register for an event. Three cases:
 *  - signed-in student: the registration is linked to their account;
 *  - new student: an account is created from `account` (email + password) and linked in one step;
 *  - staff / no account requested: plain registration (private pass link only).
 */
export const POST = handle("register", async (req: NextRequest) => {
  const ip = clientIp(req);
  const allowed = await checkRateLimit("register", ip, true);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many requests. Please wait before registering again.");

  const body = (await req.json()) as Record<string, unknown>;
  const session = await getSessionProfile();
  const student = session && session.role === "student" ? session : null;

  // Validate the account part first so the student sees every problem at once.
  let account: { email: string; password: string } | null = null;
  if (!session) {
    const parsed = accountSchema.safeParse(body.account ?? {});
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      return fail(422, "VALIDATION_ERROR", "Please check the highlighted fields.", {
        ...(f.email ? { accountEmail: f.email } : {}),
        ...(f.password ? { accountPassword: f.password } : {}),
      });
    }
    account = parsed.data;
  }

  // One account = one student ID.
  if (student) {
    const digest = await getProfileDigest(student.profileId);
    if (digest && typeof body.studentId === "string" && studentIdDigest(normalizeStudentId(body.studentId)) !== digest) {
      return fail(422, "VALIDATION_ERROR", "Please check the highlighted fields.", { studentId: ["Use the student ID linked to your account"] });
    }
  }

  // Create the account before registering, so a taken email doesn't leave an orphan registration.
  let created: { userId: string; profileId: string } | null = null;
  if (account) {
    const res = await createStudentUser(account.email, account.password, typeof body.fullName === "string" ? body.fullName.trim() : null);
    if (!res.ok) {
      return res.code === "EMAIL_TAKEN"
        ? fail(409, "EMAIL_TAKEN", "That email already has an account. Sign in first, then register.", { accountEmail: ["Already has an account — sign in instead"] })
        : fail(500, "ERROR", "Couldn't create your account. Please try again.");
    }
    created = res;
  }

  const result = await registerParticipant(body);
  if (!result.ok) {
    if (created) await deleteStudentUser(created.userId); // roll back the new account
    if (result.code === "VALIDATION_ERROR") return fail(422, result.code, "Please check the highlighted fields.", result.fields);
    const [status, msg] = REGISTER_ERRORS[result.code] ?? [400, "Registration could not be completed."];
    return fail(status, result.code, msg);
  }

  const owner = student?.profileId ?? created?.profileId ?? null;
  if (owner && result.registrationId) await linkRegistration(owner, result.registrationId, result.studentIdDigest);

  // Do NOT include accessToken in the JSON body beyond the participant path.
  return ok(
    {
      referenceCode: result.referenceCode,
      eventName: result.eventName,
      participantPath: `/p/${result.accessToken}`,
      linkedToAccount: Boolean(owner),
      accountCreated: Boolean(created),
    },
    201,
  );
});
