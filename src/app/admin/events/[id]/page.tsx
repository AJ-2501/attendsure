import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { getEventById, updateEvent } from "@/lib/services/events";
import { eventSchema, type EventInput } from "@/lib/schemas";
import { utcToZonedLocal } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import EventFormClient from "../EventFormClient";

export const metadata: Metadata = { title: "Edit Event" };

interface Props {
  params: Promise<{ id: string }>;
}

function toFormValues(e: EventRow): Partial<EventInput> {
  const local = (iso: string | null) => (iso ? utcToZonedLocal(iso, e.timezone) : null);
  return {
    name: e.name,
    description: e.description,
    venue: e.venue,
    organizer: e.organizer,
    timezone: e.timezone,
    startsAt: local(e.starts_at)!,
    endsAt: local(e.ends_at)!,
    registrationOpensAt: local(e.registration_opens_at)!,
    registrationClosesAt: local(e.registration_closes_at)!,
    timeInOpensAt: local(e.time_in_opens_at)!,
    timeInClosesAt: local(e.time_in_closes_at)!,
    timeOutOpensAt: local(e.time_out_opens_at),
    timeOutClosesAt: local(e.time_out_closes_at),
    timeOutQrTtlMinutes: Math.round(e.time_out_qr_ttl_seconds / 60),
    capacity: e.capacity,
    allowTimeIn: e.allow_time_in,
    allowTimeOut: e.allow_time_out,
    requireTimeOut: e.require_time_out,
    studentIdPattern: e.student_id_pattern,
    studentIdHint: e.student_id_hint,
    requiredFields: e.required_fields,
    status: e.status,
  };
}

export default async function EditEventPage({ params }: Props) {
  await requirePagePermission("events.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const event = await getEventById(id);
  if (!event) notFound();

  async function handleUpdate(data: unknown) {
    "use server";
    const staff = await requirePagePermission("events.manage");
    const parsed = eventSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: "Validation failed." };
    const updated = await updateEvent(id, parsed.data, staff.profileId);
    return { ok: true, id: updated.id };
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Event</h1>
        <p className="text-slate-500 text-sm">{event.name}</p>
      </div>
      <EventFormClient defaultValues={toFormValues(event)} onSubmit={handleUpdate} submitLabel="Save Changes" />
    </div>
  );
}
