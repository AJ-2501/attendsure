export type EventDbStatus = "draft" | "published" | "cancelled";
export type EffectiveStatus = "draft" | "upcoming" | "open" | "ongoing" | "completed" | "cancelled";
export type AttendanceStatus = "absent" | "checked_in" | "completed";

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  venue: string;
  organizer: string;
  timezone: string;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
  time_in_opens_at: string;
  time_in_closes_at: string;
  time_out_opens_at: string | null;
  time_out_closes_at: string | null;
  time_out_qr_ttl_seconds: number;
  capacity: number;
  allow_time_in: boolean;
  allow_time_out: boolean;
  require_time_out: boolean;
  student_id_pattern: string;
  student_id_hint: string;
  required_fields: { department: boolean; year_level: boolean; email: boolean };
  status: EventDbStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRow {
  id: string;
  event_id: string;
  reference_code: string;
  access_token_hash: string;
  participant_name_encrypted: string;
  student_id_encrypted: string;
  email_encrypted: string | null;
  student_id_lookup_digest: string;
  section: string;
  year_level: string | null;
  department: string | null;
  registration_status: "registered" | "cancelled";
  cancelled_reason: string | null;
  registered_at: string;
}

export interface AttendanceRow {
  id: string;
  registration_id: string;
  event_id: string;
  time_in_at: string | null;
  time_out_at: string | null;
  time_in_ref: string | null;
  time_out_ref: string | null;
  status: AttendanceStatus;
}

export interface CredentialRow {
  id: string;
  registration_id: string;
  event_id: string;
  action: "time_in" | "time_out";
  token_hash: string;
  expires_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  issued_by: string | null;
  created_at: string;
}

export interface ScanAttemptRow {
  id: string;
  event_id: string | null;
  credential_id: string | null;
  registration_id: string | null;
  credential_event_id: string | null;
  actor_profile_id: string | null;
  action: "time_in" | "time_out";
  method: "qr" | "manual";
  result: "accepted" | "rejected";
  result_code: string;
  confirmation_ref: string | null;
  recorded_at: string | null;
  created_at: string;
}

export interface AuditRow {
  id: string;
  event_id: string | null;
  registration_id: string | null;
  actor_user_id: string | null;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EventStats {
  registered: number;
  timed_in: number;
  timed_out: number;
  checked_in: number;
  not_arrived: number;
  cancelled: number;
  rejected_scans: number;
  accepted_scans: number;
}
