import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { EventRow, PublicEvent } from "@/lib/types";
export type { PublicEvent };
import type { EventParsed } from "@/lib/schemas";

export async function listPublishedEvents(): Promise<EventRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("starts_at", { ascending: true })
    .returns<EventRow[]>();
  return data ?? [];
}

export async function listAllEvents(page = 1, pageSize = 25): Promise<{ events: EventRow[]; total: number }> {
  const db = createAdminClient();
  const from = (page - 1) * pageSize;
  const { data, count } = await db
    .from("events")
    .select("*", { count: "exact" })
    .order("starts_at", { ascending: false })
    .range(from, from + pageSize - 1)
    .returns<EventRow[]>();
  return { events: data ?? [], total: count ?? 0 };
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const db = createAdminClient();
  const { data } = await db.from("events").select("*").eq("id", id).maybeSingle<EventRow>();
  return data;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const db = createAdminClient();
  const { data } = await db.from("events").select("*").eq("slug", slug).maybeSingle<EventRow>();
  return data;
}

export async function createEvent(parsed: EventParsed, profileId: string): Promise<EventRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .insert({
      name: parsed.name,
      description: parsed.description,
      venue: parsed.venue,
      organizer: parsed.organizer,
      timezone: parsed.timezone,
      starts_at: parsed.startsAt,
      ends_at: parsed.endsAt,
      registration_opens_at: parsed.registrationOpensAt,
      registration_closes_at: parsed.registrationClosesAt,
      time_in_opens_at: parsed.timeInOpensAt,
      time_in_closes_at: parsed.timeInClosesAt,
      time_out_opens_at: parsed.timeOutOpensAt,
      time_out_closes_at: parsed.timeOutClosesAt,
      time_out_qr_ttl_seconds: parsed.timeOutQrTtlMinutes * 60,
      capacity: parsed.capacity,
      allow_time_in: parsed.allowTimeIn,
      allow_time_out: parsed.allowTimeOut,
      require_time_out: parsed.requireTimeOut,
      student_id_pattern: parsed.studentIdPattern,
      student_id_hint: parsed.studentIdHint,
      required_fields: parsed.requiredFields,
      status: parsed.status,
      created_by: profileId,
    })
    .select()
    .single<EventRow>();
  if (error) throw error;
  return data;
}

export async function updateEvent(id: string, parsed: EventParsed, actorId: string): Promise<EventRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({
      name: parsed.name,
      description: parsed.description,
      venue: parsed.venue,
      organizer: parsed.organizer,
      timezone: parsed.timezone,
      starts_at: parsed.startsAt,
      ends_at: parsed.endsAt,
      registration_opens_at: parsed.registrationOpensAt,
      registration_closes_at: parsed.registrationClosesAt,
      time_in_opens_at: parsed.timeInOpensAt,
      time_in_closes_at: parsed.timeInClosesAt,
      time_out_opens_at: parsed.timeOutOpensAt,
      time_out_closes_at: parsed.timeOutClosesAt,
      time_out_qr_ttl_seconds: parsed.timeOutQrTtlMinutes * 60,
      capacity: parsed.capacity,
      allow_time_in: parsed.allowTimeIn,
      allow_time_out: parsed.allowTimeOut,
      require_time_out: parsed.requireTimeOut,
      student_id_pattern: parsed.studentIdPattern,
      student_id_hint: parsed.studentIdHint,
      required_fields: parsed.requiredFields,
      status: parsed.status,
    })
    .eq("id", id)
    .select()
    .single<EventRow>();
  if (error) throw error;
  // audit
  await db.from("attendance_audit_logs").insert({
    event_id: id,
    actor_user_id: actorId,
    action: "event.updated",
    metadata: { name: parsed.name, status: parsed.status },
  });
  return data;
}

export async function listParticipants(opts: {
  eventId: string;
  q?: string;
  section?: string;
  status?: string;
  page: number;
  pageSize: number;
  sort: string;
  dir: string;
}) {
  const db = createAdminClient();
  const from = (opts.page - 1) * opts.pageSize;
  let q = db
    .from("registrations")
    .select("*, attendance_records(time_in_at, time_out_at, status)", { count: "exact" })
    .eq("event_id", opts.eventId);
  if (opts.section) q = q.ilike("section", `%${opts.section}%`);
  if (opts.status) q = q.eq("attendance_records.status", opts.status);
  q = q.order(opts.sort, { ascending: opts.dir === "asc" }).range(from, from + opts.pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export function toPublicEvent(e: EventRow): PublicEvent {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    venue: e.venue,
    organizer: e.organizer,
    timezone: e.timezone,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    registration_opens_at: e.registration_opens_at,
    registration_closes_at: e.registration_closes_at,
    time_in_opens_at: e.time_in_opens_at,
    time_in_closes_at: e.time_in_closes_at,
    time_out_opens_at: e.time_out_opens_at,
    time_out_closes_at: e.time_out_closes_at,
    capacity: e.capacity,
    allow_time_out: e.allow_time_out,
  };
}

/** A single published event for the public detail page; drafts and cancelled events stay hidden. */
export async function getPublishedEvent(id: string): Promise<EventRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createAdminClient();
  const { data } = await db.from("events").select("*").eq("id", id).eq("status", "published").maybeSingle<EventRow>();
  return data;
}

/** Active registration count per event (head-only count queries; no rows transferred). */
export async function countRegistrations(eventIds: string[]): Promise<Record<string, number>> {
  const db = createAdminClient();
  const entries = await Promise.all(
    eventIds.map(async (id) => {
      const { count } = await db
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id)
        .eq("registration_status", "registered");
      return [id, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}
