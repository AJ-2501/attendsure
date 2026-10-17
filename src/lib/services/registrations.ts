import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { FIELD, tdesDecrypt, tdesEncrypt } from "@/lib/crypto/tdes";
import { newAccessToken, newQrCredential, newReferenceCode, sha256Hex, studentIdDigest } from "@/lib/crypto/tokens";
import { buildRegistrationSchema, normalizeStudentId, type RegistrationRules } from "@/lib/schemas";
import { serverEnv } from "@/lib/env";
import type { AttendanceRow, CredentialRow, EventRow, RegistrationRow } from "@/lib/types";

export function rulesFor(event: Pick<EventRow, "student_id_pattern" | "student_id_hint" | "required_fields">): RegistrationRules {
  return {
    studentIdPattern: event.student_id_pattern,
    studentIdHint: event.student_id_hint,
    requiredFields: event.required_fields,
    emailDomain: serverEnv().schoolEmailDomain,
  };
}

export type RegisterResult =
  | { ok: true; referenceCode: string; accessToken: string; eventName: string }
  | { ok: false; code: string; fields?: Record<string, string[]> };

/**
 * Registration pipeline:
 * validate -> eligibility -> HMAC lookup digest -> 3DES encrypt -> atomic RPC
 * (capacity lock, duplicate check, registration + attendance + time-in credential).
 */
export async function registerParticipant(raw: unknown): Promise<RegisterResult> {
  const db = createAdminClient();
  const eventId = typeof raw === "object" && raw && "eventId" in raw ? String((raw as { eventId: unknown }).eventId) : "";
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { ok: false, code: "VALIDATION_ERROR", fields: { eventId: ["Select an event"] } };

  const { data: event } = await db.from("events").select("*").eq("id", eventId).maybeSingle<EventRow>();
  if (!event || event.status !== "published") return { ok: false, code: "EVENT_NOT_AVAILABLE" };

  const parsed = buildRegistrationSchema(rulesFor(event)).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const v = parsed.data;

  const digest = studentIdDigest(v.studentId);
  const access = newAccessToken();
  const cred = newQrCredential();
  const referenceCode = newReferenceCode();

  const { data, error } = await db.rpc("register_participant", {
    p_event_id: event.id,
    p_reference_code: referenceCode,
    p_access_token_hash: access.hash,
    p_name_enc: tdesEncrypt(v.fullName, FIELD.name),
    p_student_id_enc: tdesEncrypt(v.studentId, FIELD.studentId),
    p_email_enc: v.email ? tdesEncrypt(v.email, FIELD.email) : null,
    p_lookup_digest: digest,
    p_section: v.section,
    p_year_level: v.yearLevel || null,
    p_department: v.department || null,
    p_time_in_cred_id: cred.id,
    p_time_in_token_hash: cred.tokenHash,
  } as never);
  if (error) throw new Error("register_participant failed");
  const r = data as { ok: boolean; code: string };
  if (!r.ok) return { ok: false, code: r.code };
  return { ok: true, referenceCode, accessToken: access.token, eventName: event.name };
}

export interface ParticipantView {
  registration: Pick<RegistrationRow, "id" | "reference_code" | "section" | "year_level" | "department" | "registration_status" | "registered_at">;
  fullName: string;
  maskedStudentId: string;
  event: EventRow;
  attendance: AttendanceRow;
  credentials: CredentialRow[];
}

export function maskStudentId(id: string) {
  if (id.length <= 4) return "•".repeat(id.length);
  return id.slice(0, 2) + "•".repeat(id.length - 4) + id.slice(-2);
}

/** Capability-token access for participant pages (token proves possession of the private link). */
export async function getParticipantByAccessToken(token: string): Promise<ParticipantView | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const db = createAdminClient();
  const { data: reg } = await db
    .from("registrations")
    .select("*")
    .eq("access_token_hash", sha256Hex(token))
    .maybeSingle<RegistrationRow>();
  if (!reg) return null;
  const [{ data: event }, { data: attendance }, { data: credentials }] = await Promise.all([
    db.from("events").select("*").eq("id", reg.event_id).single<EventRow>(),
    db.from("attendance_records").select("*").eq("registration_id", reg.id).single<AttendanceRow>(),
    db.from("qr_credentials").select("*").eq("registration_id", reg.id).order("created_at", { ascending: true }).returns<CredentialRow[]>(),
  ]);
  if (!event || !attendance) return null;
  return {
    registration: reg,
    fullName: tdesDecrypt(reg.participant_name_encrypted, FIELD.name),
    maskedStudentId: maskStudentId(tdesDecrypt(reg.student_id_encrypted, FIELD.studentId)),
    event,
    attendance,
    credentials: credentials ?? [],
  };
}

/** Staff-only decrypt helper (callers MUST have passed requirePermission). */
export function decryptIdentity(reg: Pick<RegistrationRow, "participant_name_encrypted" | "student_id_encrypted">) {
  return {
    fullName: tdesDecrypt(reg.participant_name_encrypted, FIELD.name),
    studentId: tdesDecrypt(reg.student_id_encrypted, FIELD.studentId),
  };
}

/** Staff lookup by student ID (via HMAC digest) or reference code within an event. */
export async function findRegistration(eventId: string, query: string) {
  const db = createAdminClient();
  const q = query.trim().toUpperCase();
  const isRef = /^SA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(q);
  const base = db.from("registrations").select("*").eq("event_id", eventId);
  const { data } = isRef
    ? await base.eq("reference_code", q).maybeSingle<RegistrationRow>()
    : await base.eq("student_id_lookup_digest", studentIdDigest(normalizeStudentId(q))).maybeSingle<RegistrationRow>();
  return data;
}
