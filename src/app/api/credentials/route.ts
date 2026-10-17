import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { reissueSchema, reasonSchema } from "@/lib/schemas";
import { staffReissueCredential, revokeCredentials } from "@/lib/services/credentials";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export const POST = handle("credentials-reissue", async (req: NextRequest) => {
  const staff = await requirePermission("credentials.manage");
  const { searchParams } = new URL(req.url);
  const sub = searchParams.get("action") ?? "reissue";

  if (sub === "reissue") {
    const body = reissueSchema.parse(await req.json());
    const result = await staffReissueCredential(body.registrationId, body.action, staff.profileId, body.reason);
    if (!result.ok) return fail(400, result.code, `Could not reissue: ${result.code}`);
    return ok({ token: result.token, expiresAt: result.expiresAt });
  }

  if (sub === "revoke") {
    const body = reissueSchema.parse(await req.json());
    const result = await revokeCredentials(body.registrationId, body.action, staff.profileId, body.reason);
    if (!result.ok) return fail(400, result.code, `Could not revoke: ${result.code}`);
    return ok({ revokedCount: result.revoked_count });
  }

  return fail(400, "BAD_REQUEST", "Unknown credential action.");
});
