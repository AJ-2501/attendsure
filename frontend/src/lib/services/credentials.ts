import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { deriveQrToken, newQrCredential } from "@/lib/crypto/tokens";
import type { CredentialRow } from "@/lib/types";

/** Issue time-out QR (self-service — participant must have access token). */
export async function selfIssueTimeOut(registrationId: string): Promise<{
  ok: boolean;
  code: string;
  token?: string;
  expiresAt?: string;
  revoked?: number;
}> {
  const db = createAdminClient();
  const cred = newQrCredential();
  const { data, error } = await db.rpc("issue_credential", {
    p_registration_id: registrationId,
    p_action: "time_out",
    p_cred_id: cred.id,
    p_token_hash: cred.tokenHash,
    p_issued_by: null,
    p_self: true,
    p_reason: null,
  } as never);
  if (error) throw error;
  const r = data as { ok: boolean; code: string; expires_at?: string; revoked_count?: number };
  if (!r.ok) return { ok: false, code: r.code };
  return { ok: true, code: r.code, token: cred.token, expiresAt: r.expires_at, revoked: r.revoked_count };
}

/** Staff reissue (time_in or time_out), audited. */
export async function staffReissueCredential(
  registrationId: string,
  action: "time_in" | "time_out",
  issuedBy: string,
  reason: string,
): Promise<{ ok: boolean; code: string; token?: string; expiresAt?: string }> {
  const db = createAdminClient();
  const cred = newQrCredential();
  const { data, error } = await db.rpc("issue_credential", {
    p_registration_id: registrationId,
    p_action: action,
    p_cred_id: cred.id,
    p_token_hash: cred.tokenHash,
    p_issued_by: issuedBy,
    p_self: false,
    p_reason: reason,
  } as never);
  if (error) throw error;
  const r = data as { ok: boolean; code: string; expires_at?: string };
  if (!r.ok) return { ok: false, code: r.code };
  return { ok: true, code: r.code, token: cred.token, expiresAt: r.expires_at };
}

/** Revoke all live credentials for a registration (staff). */
export async function revokeCredentials(
  registrationId: string,
  action: "time_in" | "time_out" | null,
  actor: string,
  reason: string,
) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("revoke_credentials", {
    p_registration_id: registrationId,
    p_action: action,
    p_actor: actor,
    p_reason: reason,
  } as never);
  if (error) throw error;
  return data as { ok: boolean; code: string; revoked_count: number };
}

/** Re-derive the display token for a given credential id. Only call server-side. */
export function getTokenForCredential(credentialId: string): string {
  return deriveQrToken(credentialId);
}

/** Look up a credential by the scanned token. Return just what is safe to display (no full token). */
export async function getCredentialStatus(registrationId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("qr_credentials")
    .select("id, action, expires_at, used_at, revoked_at, created_at")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false })
    .returns<Pick<CredentialRow, "id" | "action" | "expires_at" | "used_at" | "revoked_at" | "created_at">[]>();
  return data ?? [];
}
