import { type NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api";
import { scanRequestSchema } from "@/lib/schemas";
import { requirePermission } from "@/lib/auth/session";
import { describeCredential, processScan } from "@/lib/services/attendance";
import { checkRateLimit } from "@/lib/rate-limit";
import { ACTION_LABEL, message } from "@/lib/messages";
import { decryptIdentity } from "@/lib/services/registrations";
import { getEventById } from "@/lib/services/events";
import { createAdminClient } from "@/lib/supabase/server";
import { formatInZone, timeOutWindow } from "@/lib/time";
import type { RegistrationRow } from "@/lib/types";

export const runtime = "nodejs";

export const POST = handle("scan", async (req: NextRequest) => {
  const staff = await requirePermission("scan.perform");
  const allowed = await checkRateLimit("scan", staff.profileId, false);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many scan requests. Please slow down.");

  const body = scanRequestSchema.parse(await req.json());

  // Auto mode: use the action the pass was issued for, so staff never need to switch modes.
  const cred = await describeCredential(body.token);
  const action = body.action === "auto" ? (cred?.action ?? "time_in") : body.action;

  const result = await processScan(body.token, body.eventId, action, staff.profileId, body.idempotencyKey);

  // Make rejections actionable for the person at the door.
  let msg = message(result.code);
  if (result.code === "WRONG_EVENT" && cred?.eventName) {
    msg = `This pass is for “${cred.eventName}”. Switch the event at the top of the scanner.`;
  } else if (result.code === "WRONG_ACTION" && cred) {
    msg = `This is a ${ACTION_LABEL[cred.action]} pass. Switch the scanner to ${ACTION_LABEL[cred.action]} or Auto.`;
  } else if (result.code === "OUTSIDE_WINDOW") {
    const ev = await getEventById(body.eventId);
    if (ev) {
      const w = action === "time_in" ? { opens: ev.time_in_opens_at, closes: ev.time_in_closes_at } : timeOutWindow(ev);
      const f = (iso: string) => formatInZone(iso, ev.timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      msg = `${ACTION_LABEL[action]} scanning is open ${f(w.opens)} – ${f(w.closes)}. Edit the event to change this window.`;
    }
  }

  // Resolve identity when we know the registration (staff already authenticated).
  let identity: { fullName: string; studentId: string } | null = null;
  if (result.registrationId) {
    const { data: reg } = await createAdminClient()
      .from("registrations")
      .select("participant_name_encrypted, student_id_encrypted")
      .eq("id", result.registrationId)
      .maybeSingle<Pick<RegistrationRow, "participant_name_encrypted" | "student_id_encrypted">>();
    if (reg) {
      try {
        identity = decryptIdentity(reg);
      } catch {}
    }
  }

  return ok({
    code: result.code,
    accepted: result.code === "ACCEPTED",
    action,
    message: msg,
    registrationId: result.registrationId,
    recordedAt: result.recordedAt,
    confirmationRef: result.confirmationRef,
    replayed: result.replayed,
    identity,
  });
});
