import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { FIELD, tdesDecrypt } from "@/lib/crypto/tdes";
import { deriveQrToken, newAccessToken, studentIdDigest } from "@/lib/crypto/tokens";
import { normalizeStudentId, studentSignupSchema } from "@/lib/schemas";
import { selfIssueTimeOut } from "@/lib/services/credentials";
import { timeOutWindow } from "@/lib/time";
import { log } from "@/lib/logger";
import type { AttendanceRow, CredentialRow, EventRow, RegistrationRow } from "@/lib/types";

/*
 * Ownership model: an account sees ONLY registrations linked to it (registrations.linked_profile_id).
 * A link is made when the signed-in student registers, or when they prove a registration with its
 * own reference code. Matching on student ID alone would expose another student's passes to anyone
 * who registers with that ID.
 */

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type CreateAccountResult = { ok: true; userId: string; profileId: string } | { ok: false; code: "EMAIL_TAKEN" | "ERROR" };

/** Create a pre-confirmed student auth user (no email round-trip) and return its profile. */
export async function createStudentUser(email: string, password: string, displayName: string | null): Promise<CreateAccountResult> {
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (error || !data.user) {
    if (/already|registered|exists/i.test(error?.message ?? "")) return { ok: false, code: "EMAIL_TAKEN" };
    log.error("student_user_create", { message: error?.message ?? "no user" });
    return { ok: false, code: "ERROR" };
  }
  // handle_new_user() inserts the 'student' profile in the same transaction as the auth user.
  const { data: profile } = await db
    .from("profiles")
    .update({ display_name: displayName })
    .eq("auth_user_id", data.user.id)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (!profile) {
    await db.auth.admin.deleteUser(data.user.id);
    log.error("student_profile_missing", {});
    return { ok: false, code: "ERROR" };
  }
  return { ok: true, userId: data.user.id, profileId: profile.id };
}

export async function deleteStudentUser(userId: string) {
  await createAdminClient().auth.admin.deleteUser(userId);
}

/** Attach a registration to an account and remember the account's student ID. */
export async function linkRegistration(profileId: string, registrationId: string, digest: string) {
  const db = createAdminClient();
  await db.from("registrations").update({ linked_profile_id: profileId }).eq("id", registrationId);
  await db.from("profiles").update({ student_id_digest: digest }).eq("id", profileId).is("student_id_digest", null);
}

/** The student ID digest an account is tied to, if any. */
export async function getProfileDigest(profileId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("profiles").select("student_id_digest").eq("id", profileId).maybeSingle<{ student_id_digest: string | null }>();
  return data?.student_id_digest ?? null;
}

async function findProvenRegistration(studentId: string, referenceCode: string) {
  const digest = studentIdDigest(normalizeStudentId(studentId));
  const { data } = await createAdminClient()
    .from("registrations")
    .select("id, participant_name_encrypted, linked_profile_id")
    .eq("reference_code", referenceCode.trim().toUpperCase())
    .eq("student_id_lookup_digest", digest)
    .maybeSingle<Pick<RegistrationRow, "id" | "participant_name_encrypted"> & { linked_profile_id: string | null }>();
  return data ? { ...data, digest } : null;
}

export type SignupResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION_ERROR"; fields: Record<string, string[]> }
  | { ok: false; code: "INVALID_PROOF" | "ALREADY_CLAIMED" | "EMAIL_TAKEN" | "ERROR" };

/** Account for a student who registered earlier without one: proven with that registration's reference code. */
export async function createStudentAccount(raw: unknown): Promise<SignupResult> {
  const parsed = studentSignupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const { email, password, studentId, referenceCode } = parsed.data;

  const reg = await findProvenRegistration(studentId, referenceCode);
  if (!reg) return { ok: false, code: "INVALID_PROOF" };
  if (reg.linked_profile_id) return { ok: false, code: "ALREADY_CLAIMED" };

  let name: string | null = null;
  try { name = tdesDecrypt(reg.participant_name_encrypted, FIELD.name); } catch {}
  const account = await createStudentUser(email, password, name);
  if (!account.ok) return { ok: false, code: account.code };
  await linkRegistration(account.profileId, reg.id, reg.digest);
  return { ok: true };
}

export type ClaimResult = { ok: true } | { ok: false; code: "INVALID_PROOF" | "ALREADY_CLAIMED" | "OTHER_STUDENT" };

/** Signed-in student adds an older registration to their dashboard. */
export async function claimRegistration(profileId: string, studentId: string, referenceCode: string): Promise<ClaimResult> {
  const reg = await findProvenRegistration(studentId, referenceCode);
  if (!reg) return { ok: false, code: "INVALID_PROOF" };
  if (reg.linked_profile_id === profileId) return { ok: true };
  if (reg.linked_profile_id) return { ok: false, code: "ALREADY_CLAIMED" };
  const digest = await getProfileDigest(profileId);
  if (digest && digest !== reg.digest) return { ok: false, code: "OTHER_STUDENT" };
  await linkRegistration(profileId, reg.id, reg.digest);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface StudentEventRecord {
  registrationId: string;
  referenceCode: string;
  registrationStatus: RegistrationRow["registration_status"];
  section: string;
  event: Pick<EventRow, "id" | "name" | "venue" | "timezone" | "starts_at" | "ends_at" | "allow_time_in" | "allow_time_out" | "require_time_out" | "time_in_opens_at" | "time_in_closes_at" | "time_out_opens_at" | "time_out_closes_at" | "time_out_qr_ttl_seconds">;
  attendance: Pick<AttendanceRow, "time_in_at" | "time_out_at" | "time_in_ref" | "time_out_ref" | "status"> | null;
  /** QR payloads — only ever sent to the signed-in owner. */
  timeInToken: string | null;
  timeOut: { token: string; expiresAt: string } | null;
  timeOutWindow: { opens: string; closes: string };
}

export interface StudentDashboard {
  fullName: string | null;
  maskedStudentId: string | null;
  records: StudentEventRecord[];
}

function mask(id: string) {
  return id.length <= 4 ? "•".repeat(id.length) : id.slice(0, 4) + "•".repeat(Math.max(0, id.length - 6)) + id.slice(-2);
}

type RegJoin = Pick<RegistrationRow, "id" | "reference_code" | "registration_status" | "section" | "participant_name_encrypted" | "student_id_encrypted" | "registered_at"> & {
  events: StudentEventRecord["event"] | null;
  attendance_records: StudentEventRecord["attendance"] | StudentEventRecord["attendance"][] | null;
};

export async function getStudentDashboard(profileId: string): Promise<StudentDashboard> {
  const db = createAdminClient();
  const { data } = await db
    .from("registrations")
    .select(
      "id, reference_code, registration_status, section, participant_name_encrypted, student_id_encrypted, registered_at, " +
        "events(id, name, venue, timezone, starts_at, ends_at, allow_time_in, allow_time_out, require_time_out, time_in_opens_at, time_in_closes_at, time_out_opens_at, time_out_closes_at, time_out_qr_ttl_seconds), " +
        "attendance_records(time_in_at, time_out_at, time_in_ref, time_out_ref, status)",
    )
    .eq("linked_profile_id", profileId)
    .returns<RegJoin[]>();
  const rows = (data ?? []).filter((r) => r.events);

  const ids = rows.map((r) => r.id);
  const { data: creds } = ids.length
    ? await db
        .from("qr_credentials")
        .select("id, registration_id, action, expires_at, created_at")
        .in("registration_id", ids)
        .is("used_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .returns<Pick<CredentialRow, "id" | "registration_id" | "action" | "expires_at" | "created_at">[]>()
    : { data: [] };
  const now = Date.now();

  let fullName: string | null = null;
  let maskedStudentId: string | null = null;
  const latest = [...rows].sort((a, b) => b.registered_at.localeCompare(a.registered_at))[0];
  if (latest) {
    try {
      fullName = tdesDecrypt(latest.participant_name_encrypted, FIELD.name);
      maskedStudentId = mask(tdesDecrypt(latest.student_id_encrypted, FIELD.studentId));
    } catch {}
  }

  const records = rows
    .map<StudentEventRecord>((r) => {
      const ev = r.events!;
      const att = Array.isArray(r.attendance_records) ? (r.attendance_records[0] ?? null) : r.attendance_records;
      const active = r.registration_status === "registered" && now < Date.parse(ev.ends_at) + 2 * 3600_000;
      const mine = (creds ?? []).filter((c) => c.registration_id === r.id);
      const tin = mine.find((c) => c.action === "time_in");
      const tout = mine.find((c) => c.action === "time_out" && c.expires_at && Date.parse(c.expires_at) > now);
      return {
        registrationId: r.id,
        referenceCode: r.reference_code,
        registrationStatus: r.registration_status,
        section: r.section,
        event: ev,
        attendance: att,
        timeInToken: active && ev.allow_time_in && !att?.time_in_at && tin ? deriveQrToken(tin.id) : null,
        timeOut: active && att?.time_in_at && !att.time_out_at && tout ? { token: deriveQrToken(tout.id), expiresAt: tout.expires_at! } : null,
        timeOutWindow: timeOutWindow(ev),
      };
    })
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
  return { fullName, maskedStudentId, records };
}

async function ownsRegistration(profileId: string, registrationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(registrationId)) return false;
  const { data } = await createAdminClient()
    .from("registrations")
    .select("id")
    .eq("id", registrationId)
    .eq("linked_profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

/** Student requests a time-out QR for one of their own registrations. */
export async function issueTimeOutPass(profileId: string, registrationId: string) {
  if (!(await ownsRegistration(profileId, registrationId))) return { ok: false as const, code: "NOT_REGISTERED" };
  return selfIssueTimeOut(registrationId);
}

/**
 * Issue a fresh private pass link for one of the student's own registrations.
 * Only a hash of the link token is stored, so the old link stops working (single active link).
 */
export async function reissuePassLink(profileId: string, registrationId: string): Promise<string | null> {
  if (!(await ownsRegistration(profileId, registrationId))) return null;
  const access = newAccessToken();
  const { data } = await createAdminClient()
    .from("registrations")
    .update({ access_token_hash: access.hash })
    .eq("id", registrationId)
    .eq("registration_status", "registered")
    .select("id")
    .maybeSingle();
  return data ? access.token : null;
}

/** Details from the student's latest registration, to prefill the next registration form. */
export async function getStudentPrefill(profileId: string) {
  const { data } = await createAdminClient()
    .from("registrations")
    .select("participant_name_encrypted, student_id_encrypted, section, year_level, department, email_encrypted, registered_at")
    .eq("linked_profile_id", profileId)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<RegistrationRow, "participant_name_encrypted" | "student_id_encrypted" | "section" | "year_level" | "department" | "email_encrypted">>();
  if (!data) return null;
  try {
    return {
      fullName: tdesDecrypt(data.participant_name_encrypted, FIELD.name),
      studentId: tdesDecrypt(data.student_id_encrypted, FIELD.studentId),
      section: data.section,
      yearLevel: data.year_level ?? "",
      department: data.department ?? "",
    };
  } catch {
    return null;
  }
}
