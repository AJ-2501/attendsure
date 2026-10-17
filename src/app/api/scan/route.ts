import { type NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api";
import { scanRequestSchema } from "@/lib/schemas";
import { requirePermission } from "@/lib/auth/session";
import { processScan } from "@/lib/services/attendance";
import { checkRateLimit } from "@/lib/rate-limit";
import { message } from "@/lib/messages";
import { decryptIdentity } from "@/lib/services/registrations";
import { createAdminClient } from "@/lib/supabase/server";
import type { RegistrationRow } from "@/lib/types";

export const runtime = "nodejs";

export const POST = handle("scan", async (req: NextRequest) => {
  const staff = await requirePermission("scan.perform");
  const allowed = await checkRateLimit("scan", staff.profileId, false);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many scan requests. Please slow down.");

  const body = scanRequestSchema.parse(await req.json());
  const result = await processScan(body.token, body.eventId, body.action, staff.profileId, body.idempotencyKey);

  // Resolve identity only on successful scans (staff already authenticated).
  let identity: { fullName: string; studentId: string } | null = null;
  if (result.registrationId) {
    const db = createAdminClient();
    const { data: reg } = await db
      .from("registrations")
      .select("participant_name_encrypted, student_id_encrypted, section, year_level, department")
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
    message: message(result.code),
    registrationId: result.registrationId,
    recordedAt: result.recordedAt,
    confirmationRef: result.confirmationRef,
    replayed: result.replayed,
    identity,
  });
});
