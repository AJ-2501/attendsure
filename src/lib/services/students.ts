import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { FIELD, tdesDecrypt, tdesEncrypt } from "@/lib/crypto/tdes";
import { deriveQrToken, newAccessToken, studentIdDigest } from "@/lib/crypto/tokens";
import { normalizeStudentId, studentProfileSchema, studentSignupSchema } from "@/lib/schemas";
import { registerParticipant } from "@/lib/services/registrations";
import { listPublishedEvents } from "@/lib/services/events";
import { effectiveStatus, registrationPhase, timeOutWindow } from "@/lib/time";
import { selfIssueTimeOut } from "@/lib/services/credentials";
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

/** Details to prefill a registration form: saved profile first, else the latest registration. */
export async function getStudentPrefill(profileId: string) {
  const saved = await getStudentProfile(profileId);
  if (saved) return saved;
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

// ---------------------------------------------------------------------------
// Event-independent student profiles
// ---------------------------------------------------------------------------

export interface StudentProfile {
  fullName: string;
  studentId: string;
  section: string;
  yearLevel: string;
  department: string;
}

export type ProfileSignupResult =
  | { ok: true; profileId: string }
  | { ok: false; code: "VALIDATION_ERROR"; fields: Record<string, string[]> }
  | { ok: false; code: "EMAIL_TAKEN" | "NOT_MIGRATED" | "ERROR" };

/** Sign up once with personal details + credentials; no event required. */
export async function signUpStudent(raw: unknown): Promise<ProfileSignupResult> {
  const parsed = studentProfileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const v = parsed.data;

  const account = await createStudentUser(v.email, v.password, v.fullName);
  if (!account.ok) return { ok: false, code: account.code };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({
      full_name_encrypted: tdesEncrypt(v.fullName, FIELD.profileName),
      student_id_encrypted: tdesEncrypt(v.studentId, FIELD.profileStudentId),
      student_id_digest: studentIdDigest(v.studentId),
      section: v.section,
      year_level: v.yearLevel,
      department: v.department,
    })
    .eq("id", account.profileId);
  if (error) {
    await deleteStudentUser(account.userId); // roll back so the student can retry
    log.error("student_profile_save", { message: error.message });
    return { ok: false, code: /column|schema cache/i.test(error.message) ? "NOT_MIGRATED" : "ERROR" };
  }
  return { ok: true, profileId: account.profileId };
}

type ProfileRow = { full_name_encrypted: string | null; student_id_encrypted: string | null; section: string | null; year_level: string | null; department: string | null };

/** Saved student details (decrypted server-side); null if the student has no saved profile yet. */
export async function getStudentProfile(profileId: string): Promise<StudentProfile | null> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("full_name_encrypted, student_id_encrypted, section, year_level, department")
    .eq("id", profileId)
    .maybeSingle<ProfileRow>();
  if (error || !data?.full_name_encrypted || !data.student_id_encrypted) return null;
  try {
    return {
      fullName: tdesDecrypt(data.full_name_encrypted, FIELD.profileName),
      studentId: tdesDecrypt(data.student_id_encrypted, FIELD.profileStudentId),
      section: data.section ?? "",
      yearLevel: data.year_level ?? "",
      department: data.department ?? "",
    };
  } catch {
    return null;
  }
}

export type QuickRegisterResult =
  | { ok: true; referenceCode: string }
  | { ok: false; message: string; needsProfile?: boolean };

const QUICK_ERRORS: Record<string, string> = {
  DUPLICATE_REGISTRATION: "You're already registered for this event.",
  EVENT_NOT_AVAILABLE: "This event isn't accepting registrations.",
  REGISTRATION_CLOSED: "Registration for this event is closed.",
  EVENT_FULL: "This event is full.",
};

const FIELD_LABEL: Record<string, string> = {
  studentId: "Student ID", email: "Email", department: "Department", yearLevel: "Year level", section: "Section", fullName: "Name",
};

/** One-tap registration using the student's saved profile; links the registration to the account. */
export async function registerFromProfile(profileId: string, accountEmail: string | null, eventId: string): Promise<QuickRegisterResult> {
  const profile = await getStudentProfile(profileId);
  if (!profile) return { ok: false, needsProfile: true, message: "Add your student details first." };
  const result = await registerParticipant({
    eventId,
    fullName: profile.fullName,
    studentId: profile.studentId,
    section: profile.section,
    yearLevel: profile.yearLevel,
    department: profile.department,
    email: accountEmail ?? "",
    consent: true,
  });
  if (!result.ok) {
    if (result.code === "VALIDATION_ERROR") {
      const first = Object.entries(result.fields ?? {})[0];
      return {
        ok: false,
        needsProfile: true,
        message: first
          ? `${FIELD_LABEL[first[0]] ?? first[0]}: ${first[1][0]}. Update your details and try again.`
          : "Your details don't meet this event's requirements.",
      };
    }
    return { ok: false, message: QUICK_ERRORS[result.code] ?? "Couldn't register. Please try again." };
  }
  if (result.registrationId) await linkRegistration(profileId, result.registrationId, result.studentIdDigest);
  return { ok: true, referenceCode: result.referenceCode };
}

/** Update saved details (no credentials). */
export async function updateStudentProfile(profileId: string, raw: unknown): Promise<{ ok: true } | { ok: false; fields: Record<string, string[]> }> {
  const parsed = studentProfileSchema.pick({ fullName: true, studentId: true, section: true, yearLevel: true, department: true }).safeParse(raw);
  if (!parsed.success) return { ok: false, fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const v = parsed.data;
  const { error } = await createAdminClient()
    .from("profiles")
    .update({
      full_name_encrypted: tdesEncrypt(v.fullName, FIELD.profileName),
      student_id_encrypted: tdesEncrypt(v.studentId, FIELD.profileStudentId),
      student_id_digest: studentIdDigest(v.studentId),
      section: v.section,
      year_level: v.yearLevel,
      department: v.department,
    })
    .eq("id", profileId);
  if (error) return { ok: false, fields: { form: ["Couldn't save your details. Please try again."] } };
  return { ok: true };
}

/** Published events open for registration that this student hasn't joined yet. */
export async function listOpenEventsForStudent(profileId: string) {
  const now = new Date();
  const events = (await listPublishedEvents()).filter((e) => registrationPhase(e, now) === "open" && effectiveStatus(e, now) !== "completed");
  if (!events.length) return [];
  const { data } = await createAdminClient()
    .from("registrations")
    .select("event_id")
    .eq("linked_profile_id", profileId)
    .in("event_id", events.map((e) => e.id))
    .returns<{ event_id: string }[]>();
  const joined = new Set((data ?? []).map((r) => r.event_id));
  return events
    .filter((e) => !joined.has(e.id))
    .map((e) => ({ id: e.id, name: e.name, venue: e.venue, timezone: e.timezone, starts_at: e.starts_at, ends_at: e.ends_at, capacity: e.capacity }));
}
