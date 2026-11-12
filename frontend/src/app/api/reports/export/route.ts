import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { exportAttendanceCsv } from "@/lib/services/attendance";
import { createAdminClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export const GET = handle("export-csv", async (req: NextRequest) => {
  const staff = await requirePermission("reports.export");
  const eventId = new URL(req.url).searchParams.get("eventId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    return new Response("Missing eventId", { status: 400 });
  }

  // Audit the export and build the CSV in parallel.
  const [{ error }, csv] = await Promise.all([
    createAdminClient().from("attendance_audit_logs").insert({
      event_id: eventId,
      actor_user_id: staff.profileId,
      action: "report.export_csv",
      metadata: {},
    }),
    exportAttendanceCsv(eventId),
  ]);
  // Same rule as /api/records/decrypt: no personal data leaves unless the access was recorded.
  if (error) {
    log.error("export_audit_failed", { message: error.message });
    return new Response("Export is unavailable because the access could not be logged. Try again shortly.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${eventId.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
