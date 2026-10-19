import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { hashScannedToken, sha256Hex } from "@/lib/crypto/tokens";
import type { EventStats, ScanAttemptRow } from "@/lib/types";

export type ScanResult = {
  code: string;
  registrationId: string | null;
  recordedAt: string | null;
  confirmationRef: string | null;
  replayed: boolean;
};

export async function processScan(
  rawToken: string,
  eventId: string,
  action: "time_in" | "time_out",
  actorProfileId: string,
  idempotencyKey?: string,
): Promise<ScanResult> {
  const tokenHash = hashScannedToken(rawToken);
  if (!tokenHash) return { code: "INVALID_TOKEN", registrationId: null, recordedAt: null, confirmationRef: null, replayed: false };
  const db = createAdminClient();
  const { data, error } = await db.rpc("process_scan", {
    p_token_hash: tokenHash,
    p_event_id: eventId,
    p_action: action,
    p_actor: actorProfileId,
    p_idempotency_key: idempotencyKey ?? null,
  } as never);
  if (error) throw error;
  const r = data as { code: string; registration_id?: string; recorded_at?: string; confirmation_ref?: string; replayed?: boolean };
  return {
    code: r.code,
    registrationId: r.registration_id ?? null,
    recordedAt: r.recorded_at ?? null,
    confirmationRef: r.confirmation_ref ?? null,
    replayed: r.replayed ?? false,
  };
}

/** Peek at a scanned credential (no side effects): which action and event it was issued for. */
export async function describeCredential(rawToken: string): Promise<{ action: "time_in" | "time_out"; eventId: string; eventName: string | null } | null> {
  const tokenHash = hashScannedToken(rawToken);
  if (!tokenHash) return null;
  const { data } = await createAdminClient()
    .from("qr_credentials")
    .select("action, event_id, events(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle<{ action: "time_in" | "time_out"; event_id: string; events: { name: string } | null }>();
  return data ? { action: data.action, eventId: data.event_id, eventName: data.events?.name ?? null } : null;
}

export async function manualAttendance(
  registrationId: string,
  eventId: string,
  action: "time_in" | "time_out",
  actorProfileId: string,
  reason: string,
): Promise<ScanResult> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("manual_attendance", {
    p_registration_id: registrationId,
    p_event_id: eventId,
    p_action: action,
    p_actor: actorProfileId,
    p_reason: reason,
    p_idempotency_key: randomUUID(),
  } as never);
  if (error) throw error;
  const r = data as { code: string; registration_id?: string; recorded_at?: string; confirmation_ref?: string; replayed?: boolean };
  return {
    code: r.code,
    registrationId: r.registration_id ?? null,
    recordedAt: r.recorded_at ?? null,
    confirmationRef: r.confirmation_ref ?? null,
    replayed: r.replayed ?? false,
  };
}

export async function correctAttendance(
  registrationId: string,
  timeIn: string | null,
  timeOut: string | null,
  actor: string,
  reason: string,
) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("correct_attendance", {
    p_registration_id: registrationId,
    p_time_in: timeIn,
    p_time_out: timeOut,
    p_actor: actor,
    p_reason: reason,
  } as never);
  if (error) throw error;
  return data as { ok: boolean; code: string };
}

export async function cancelRegistration(registrationId: string, actor: string, reason: string) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("cancel_registration", {
    p_registration_id: registrationId,
    p_actor: actor,
    p_reason: reason,
  } as never);
  if (error) throw error;
  return data as { ok: boolean; code: string };
}

export async function getEventStats(eventId: string): Promise<EventStats | null> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("event_stats", { p_event_id: eventId } as never);
  if (error) return null;
  return data as EventStats;
}

export async function getRecentScans(eventId: string, limit = 20): Promise<ScanAttemptRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("scan_attempts")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ScanAttemptRow[]>();
  return data ?? [];
}

export async function getSectionBreakdown(eventId: string, dimension: "section" | "year_level" | "department") {
  const db = createAdminClient();
  const { data } = await db.rpc("section_breakdown", { p_event_id: eventId, p_dimension: dimension } as never);
  return (data ?? []) as { label: string; registered: number; timed_in: number; timed_out: number }[];
}

export async function getAuditLog(eventId: string, page = 1, pageSize = 25) {
  const db = createAdminClient();
  const from = (page - 1) * pageSize;
  const { data, count } = await db
    .from("attendance_audit_logs")
    .select("*", { count: "exact" })
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function exportAttendanceCsv(eventId: string): Promise<string> {
  const db = createAdminClient();
  const { data } = await db
    .from("registrations")
    .select("id, reference_code, section, year_level, department, registration_status, registered_at, attendance_records(time_in_at, time_out_at, time_in_ref, time_out_ref, status)")
    .eq("event_id", eventId)
    .order("registered_at");
  if (!data) return "";
  const { tdesDecrypt } = await import("@/lib/crypto/tdes");
  const { FIELD } = await import("@/lib/crypto/tdes");
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "reference_code,name,section,year_level,department,registration_status,time_in_at,time_in_ref,time_out_at,time_out_ref,attendance_status,registered_at";
  const rows = (data as (typeof data[0] & { participant_name_encrypted: string; attendance_records: typeof data[0]["attendance_records"] })[]).map((r) => {
    let name = "(encrypted)";
    try {
      name = tdesDecrypt((r as { participant_name_encrypted: string }).participant_name_encrypted, FIELD.name);
    } catch {}
    const att = Array.isArray(r.attendance_records) ? r.attendance_records[0] : r.attendance_records;
    return [
      r.reference_code, name, r.section, r.year_level ?? "", r.department ?? "",
      r.registration_status, att?.time_in_at ?? "", att?.time_in_ref ?? "",
      att?.time_out_at ?? "", att?.time_out_ref ?? "", att?.status ?? "", r.registered_at,
    ].map(String).map(escape).join(",");
  });
  return [header, ...rows].join("\r\n");
}

/** Integrity flags: repeated rejected scans, reuse attempts, multiple corrections. */
export async function getIntegrityFlags(eventId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("scan_attempts")
    .select("registration_id, result, result_code, count:registration_id.count()")
    .eq("event_id", eventId)
    .eq("result", "rejected")
    .not("registration_id", "is", null)
    .order("count", { ascending: false })
    .limit(50)
    .returns<{ registration_id: string; result_code: string; count: number }[]>();
  return data ?? [];
}
