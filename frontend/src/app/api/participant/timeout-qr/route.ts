import { ok, fail, handle } from "@/lib/api";
import { message } from "@/lib/messages";
import { selfIssueTimeOut } from "@/lib/services/credentials";
import type { NextRequest } from "next/server";
import { sha256Hex } from "@/lib/crypto/tokens";
import { createAdminClient } from "@/lib/supabase/server";
import type { RegistrationRow } from "@/lib/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/api";

export const runtime = "nodejs";

/** GET /api/participant/timeout-qr?accessToken=... — issues / returns fresh time-out QR token. */
export const GET = handle("timeout-qr", async (req: NextRequest) => {
  const token = new URL(req.url).searchParams.get("accessToken") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return fail(400, "BAD_REQUEST", "Invalid access token.");

  // Unknown tokens are throttled per IP; real passes per registration, so students sharing
  // campus Wi-Fi don't use up each other's limit.
  const db = createAdminClient();
  const { data: reg } = await db
    .from("registrations")
    .select("id")
    .eq("access_token_hash", sha256Hex(token))
    .maybeSingle<Pick<RegistrationRow, "id">>();
  if (!reg) {
    const allowed = await checkRateLimit("participantView", clientIp(req), true);
    return allowed ? fail(404, "NOT_FOUND", "Registration not found.") : fail(429, "RATE_LIMITED", "Too many requests.");
  }
  if (!(await checkRateLimit("timeOutIssue", reg.id, true))) return fail(429, "RATE_LIMITED", "Too many requests.");

  const result = await selfIssueTimeOut(reg.id);
  if (!result.ok) return fail(400, result.code, message(result.code));
  return ok({ token: result.token, expiresAt: result.expiresAt });
});
