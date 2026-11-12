import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { manualAttendanceSchema } from "@/lib/schemas";
import { manualAttendance } from "@/lib/services/attendance";
import { message } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/server";
import { decryptIdentity } from "@/lib/services/registrations";
import type { RegistrationRow } from "@/lib/types";

export const runtime = "nodejs";

export const POST = handle("manual-attendance", async (req: Request) => {
  const staff = await requirePermission("attendance.manual");
  const body = manualAttendanceSchema.parse(await req.json());
  const result = await manualAttendance(body.registrationId, body.eventId, body.action, staff.profileId, body.reason);

  let identity: { fullName: string; studentId: string } | null = null;
  if (result.registrationId) {
    const db = createAdminClient();
    const { data: reg } = await db
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
    message: message(result.code),
    recordedAt: result.recordedAt,
    confirmationRef: result.confirmationRef,
    identity,
  });
});
