import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { decryptSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { tdesDecryptAnyField, type FieldKey } from "@/lib/crypto/tdes";
import { createAdminClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export type DecryptResult = { field: FieldKey; value: string } | null;

/**
 * Admin-only bulk decryption of exported envelopes. Every request is audited with
 * the stated reason; plaintext is returned once with no-store and never logged.
 */
export const POST = handle("records-decrypt", async (req: NextRequest) => {
  const staff = await requirePermission("records.decrypt");
  if (!(await checkRateLimit("decrypt", staff.profileId, false))) {
    return fail(429, "RATE_LIMITED", "Too many decryption requests. Wait a minute and try again.");
  }

  const { values, reason } = decryptSchema.parse(await req.json());
  const results: DecryptResult[] = values.map((v) => tdesDecryptAnyField(v));
  const decrypted = results.filter(Boolean).length;

  const { error } = await createAdminClient().from("attendance_audit_logs").insert({
    actor_user_id: staff.profileId,
    action: "records.decrypt",
    reason,
    metadata: { requested: values.length, decrypted, failed: values.length - decrypted },
  });
  // Refuse to release plaintext if the access could not be recorded.
  if (error) {
    log.error("decrypt_audit_failed", { message: error.message });
    return fail(503, "AUDIT_UNAVAILABLE", "Decryption is unavailable because the access could not be logged. Try again shortly.");
  }

  return ok({ results });
});
