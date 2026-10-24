import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { exportAttendanceCsv } from "@/lib/services/attendance";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export const GET = handle("export-csv", async (req: NextRequest) => {
  const staff = await requirePermission("reports.export");
  const eventId = new URL(req.url).searchParams.get("eventId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    return new Response("Missing eventId", { status: 400 });
  }

  // Audit the export
  const { createAdminClient } = await import("@/lib/supabase/server");
  await createAdminClient().from("attendance_audit_logs").insert({
    event_id: eventId,
    actor_user_id: staff.profileId,
    action: "report.export_csv",
    metadata: {},
  });

  const csv = await exportAttendanceCsv(eventId);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${eventId.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
