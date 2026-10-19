import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { FIELD, tdesDecrypt } from "@/lib/crypto/tdes";
import { newAccessToken, studentIdDigest } from "@/lib/crypto/tokens";
import { studentSignupSchema } from "@/lib/schemas";
import { log } from "@/lib/logger";
import type { AttendanceRow, EventRow, RegistrationRow } from "@/lib/types";

export type SignupResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION_ERROR"; fields: Record<string, string[]> }
  | { ok: false; code: "INVALID_PROOF" | "ALREADY_LINKED" | "EMAIL_TAKEN" | "NOT_MIGRATED" };

/**
 * Create a student account. Ownership is proven by pairing the student ID with the
 * reference code of one of that student's registrations — a student ID alone is guessable.
 * The account is created pre-confirmed via the service role, so no email round-trip is needed.
 */
export async function createStudentAccount(raw: unknown): Promise<SignupResult> {
  const parsed = studentSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const { email, password, studentId, referenceCode } = parsed.data;
  const db = createAdminClient();
  const digest = studentIdDigest(studentId);

  const { data: reg } = await db
    .from("registrations")
    .select("id, participant_name_encrypted")
    .eq("reference_code", referenceCode)
    .eq("student_id_lookup_digest", digest)
    .maybeSingle<Pick<RegistrationRow, "id" | "participant_name_encrypted">>();
  if (!reg) return { ok: false, code: "INVALID_PROOF" };

  const existing = await db.from("profiles").select("id").eq("student_id_digest", digest).maybeSingle();
  if (existing.error) {
    log.error("student_signup_schema", { message: existing.error.message });
    return { ok: false, code: "NOT_MIGRATED" };
  }
  if (existing.data) return { ok: false, code: "ALREADY_LINKED" };

  let displayName: string | null = null;
  try {
    displayName = tdesDecrypt(reg.participant_name_encrypted, FIELD.name);
  } catch {}

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError || !created.user) {
    const taken = /already|registered|exists/i.test(createError?.message ?? "");
    if (!taken) log.error("student_signup_create", { message: createError?.message ?? "no user" });
    return { ok: false, code: taken ? "EMAIL_TAKEN" : "INVALID_PROOF" };
  }

  // handle_new_user() created a 'student' profile; attach the verified student ID to it.
  const { data: profile, error: linkError } = await db
    .from("profiles")
    .update({ student_id_digest: digest, display_name: displayName })
    .eq("auth_user_id", created.user.id)
    .eq("role", "student")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (linkError || !profile) {
    // Roll back so the student can retry cleanly (e.g. lost a race on the unique digest).
    await db.auth.admin.deleteUser(created.user.id);
    return { ok: false, code: linkError?.code === "23505" ? "ALREADY_LINKED" : "INVALID_PROOF" };
  }
  await db.from("registrations").update({ linked_profile_id: profile.id }).eq("student_id_lookup_digest", digest);
  return { ok: true };
}

export interface StudentEventRecord {
  registrationId: string;
  referenceCode: string;
  registrationStatus: RegistrationRow["registration_status"];
  section: string;
  event: Pick<EventRow, "id" | "name" | "venue" | "timezone" | "starts_at" | "ends_at" | "allow_time_in" | "allow_time_out" | "require_time_out">;
  attendance: Pick<AttendanceRow, "time_in_at" | "time_out_at" | "time_in_ref" | "time_out_ref" | "status"> | null;
}

export interface StudentDashboard {
  linked: boolean;
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

/** Every registration belonging to this student's verified ID, newest event first. */
export async function getStudentDashboard(profileId: string): Promise<StudentDashboard> {
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("student_id_digest")
    .eq("id", profileId)
    .maybeSingle<{ student_id_digest: string | null }>();
  if (!profile?.student_id_digest) return { linked: false, fullName: null, maskedStudentId: null, records: [] };

  const { data } = await db
    .from("registrations")
    .select(
      "id, reference_code, registration_status, section, participant_name_encrypted, student_id_encrypted, registered_at, " +
        "events(id, name, venue, timezone, starts_at, ends_at, allow_time_in, allow_time_out, require_time_out), " +
        "attendance_records(time_in_at, time_out_at, time_in_ref, time_out_ref, status)",
    )
    .eq("student_id_lookup_digest", profile.student_id_digest)
    .returns<RegJoin[]>();

  const rows = (data ?? []).filter((r) => r.events);
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
    .map<StudentEventRecord>((r) => ({
      registrationId: r.id,
      referenceCode: r.reference_code,
      registrationStatus: r.registration_status,
      section: r.section,
      event: r.events!,
      attendance: Array.isArray(r.attendance_records) ? (r.attendance_records[0] ?? null) : r.attendance_records,
    }))
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
  return { linked: true, fullName, maskedStudentId, records };
}

/**
 * Issue a fresh private pass link for one of the student's own registrations.
 * Only a hash of the link token is stored, so the old link stops working (single active link).
 */
export async function reissuePassLink(profileId: string, registrationId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(registrationId)) return null;
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("student_id_digest")
    .eq("id", profileId)
    .maybeSingle<{ student_id_digest: string | null }>();
  if (!profile?.student_id_digest) return null;
  const access = newAccessToken();
  const { data } = await db
    .from("registrations")
    .update({ access_token_hash: access.hash })
    .eq("id", registrationId)
    .eq("student_id_lookup_digest", profile.student_id_digest)
    .eq("registration_status", "registered")
    .select("id")
    .maybeSingle();
  return data ? access.token : null;
}
