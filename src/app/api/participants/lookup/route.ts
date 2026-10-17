import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { findRegistration, decryptIdentity } from "@/lib/services/registrations";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export const GET = handle("participants-lookup", async (req: NextRequest) => {
  await requirePermission("participants.view");
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId") ?? "";
  const q = searchParams.get("q") ?? "";
  if (!eventId || !q) return fail(400, "BAD_REQUEST", "eventId and q are required.");

  const reg = await findRegistration(eventId, q);
  if (!reg) return fail(404, "NOT_FOUND", "No registration found matching that query.");

  let identity: { fullName: string; studentId: string } | null = null;
  try { identity = decryptIdentity(reg); } catch {}

  return ok({
    registrationId: reg.id,
    referenceCode: reg.reference_code,
    section: reg.section,
    status: reg.registration_status,
    identity,
  });
});
