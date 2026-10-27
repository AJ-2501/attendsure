import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import { requirePagePermission } from "@/lib/auth/session";
import { countRegistrations, getEventById } from "@/lib/services/events";
import type { EventInput } from "@/lib/schemas";
import { effectiveStatus, STATUS_BADGE, STATUS_LABEL, utcToZonedLocal } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import EventFormClient from "../EventFormClient";
import DeleteEventButton from "../DeleteEventButton";
import { updateEventAction } from "../actions";

export const metadata: Metadata = { title: "Edit event" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
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

export default async function EditEventPage({ params, searchParams }: Props) {
  await requirePagePermission("events.manage");
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const event = await getEventById(id);
  if (!event) notFound();
  const registrations = (await countRegistrations([id]))[id] ?? 0;
  const status = effectiveStatus(event);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-fade-up">
      <div className="flex flex-col gap-2">
        <Link href="/admin/events" prefetch={true} className="self-start -ml-2 min-h-11 pl-1 pr-3 rounded-xl inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:bg-brand-50">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" /> All events
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <span className={clsx("badge", STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>
            <h1 className="mt-1.5 text-xl sm:text-2xl font-bold text-ink break-words">{event.name}</h1>
            <p className="text-sm text-[#4b6362]">{registrations.toLocaleString()} of {event.capacity.toLocaleString()} registered</p>
          </div>
          {event.status === "published" && (
            <Link href={`/events/${event.id}`} target="_blank" className="btn-secondary self-start sm:self-auto">
              View public page <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {saved && (
        <div role="status" className="scan-accepted text-sm font-semibold flex items-center gap-2 max-w-3xl">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Changes saved.
        </div>
      )}

      <EventFormClient
        defaultValues={toFormValues(event)}
        onSubmit={updateEventAction.bind(null, id)}
        submitLabel="Save changes"
      />

      <section aria-labelledby="danger" className="card p-4 sm:p-6 border-danger-500/30 max-w-3xl flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 id="danger" className="font-bold text-danger-600">Danger zone</h2>
          <p className="text-sm text-[#4b6362]">
            Delete this event and its {registrations.toLocaleString()} registration{registrations === 1 ? "" : "s"}. To hide it from students instead, set Status to Cancelled or Draft.
          </p>
        </div>
        <DeleteEventButton eventId={event.id} eventName={event.name} registrations={registrations} />
      </section>
    </div>
  );
}
