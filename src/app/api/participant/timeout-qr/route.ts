import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
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

  const ip = clientIp(req);
  const allowed = await checkRateLimit("timeOutIssue", ip, true);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many requests.");

  const db = createAdminClient();
  const { data: reg } = await db
    .from("registrations")
    .select("id")
    .eq("access_token_hash", sha256Hex(token))
    .maybeSingle<Pick<RegistrationRow, "id">>();
  if (!reg) return fail(404, "NOT_FOUND", "Registration not found.");

  const result = await selfIssueTimeOut(reg.id);
  if (!result.ok) return fail(400, result.code, result.code);
  return ok({ token: result.token, expiresAt: result.expiresAt });
});
