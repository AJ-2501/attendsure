import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { correctionSchema } from "@/lib/schemas";
import { correctAttendance } from "@/lib/services/attendance";
import { message } from "@/lib/messages";

export const runtime = "nodejs";

export const POST = handle("correct-attendance", async (req: Request) => {
  const staff = await requirePermission("attendance.correct");
  const body = correctionSchema.parse(await req.json());
  const result = await correctAttendance(body.registrationId, body.timeIn, body.timeOut, staff.profileId, body.reason);
  return ok({ code: result.code, message: message(result.code) });
});
