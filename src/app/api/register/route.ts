import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, handle, clientIp } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerParticipant } from "@/lib/services/registrations";
import { listPublishedEvents } from "@/lib/services/events";

export const runtime = "nodejs";

export const GET = handle("register", async () => {
  const events = await listPublishedEvents();
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
  return ok(safe);
});

export const POST = handle("register", async (req: NextRequest) => {
  const ip = clientIp(req);
  const allowed = await checkRateLimit("register", ip, true);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many requests. Please wait before registering again.");

  const body = await req.json();
  const result = await registerParticipant(body);
  if (!result.ok) {
    if (result.code === "VALIDATION_ERROR") return fail(422, result.code, "Please check the highlighted fields.", result.fields);
    if (result.code === "DUPLICATE_REGISTRATION") return fail(409, result.code, "You are already registered for this event.");
    if (result.code === "EVENT_NOT_AVAILABLE") return fail(400, result.code, "This event is not accepting registrations.");
    if (result.code === "REGISTRATION_CLOSED") return fail(400, result.code, "Registration for this event is closed.");
    if (result.code === "EVENT_FULL") return fail(409, result.code, "This event has reached its maximum capacity.");
    return fail(400, result.code, "Registration could not be completed.");
  }
  // Do NOT include accessToken in API response — redirect to the participant page instead.
  return ok(
    {
      referenceCode: result.referenceCode,
      eventName: result.eventName,
      participantPath: `/p/${result.accessToken}`,
    },
    201,
  );
});
