import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { createEvent } from "@/lib/services/events";
import { eventSchema } from "@/lib/schemas";
import EventFormClient from "../EventFormClient";

export const metadata: Metadata = { title: "New Event" };

async function handleCreate(data: unknown) {
  "use server";
  const staff = await requirePagePermission("events.manage");
  const parsed = eventSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Validation failed." };
  const event = await createEvent(parsed.data, staff.profileId);
  return { ok: true, id: event.id };
}

export default async function NewEventPage() {
  await requirePagePermission("events.manage");
  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Event</h1>
        <p className="text-slate-500 text-sm">Create a new school event.</p>
      </div>
      <EventFormClient onSubmit={handleCreate} submitLabel="Create Event" />
    </div>
  );
}
