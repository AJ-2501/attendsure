import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import Link from "next/link";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  await requirePagePermission("events.manage");
  const { events } = await listAllEvents(1, 50);
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <Link href="/admin/events/new" className="btn-primary btn-sm">+ New Event</Link>
      </div>
      <div className="space-y-3">
        {events.map((e) => (
          <div key={e.id} className="card p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">{e.name}</p>
              <p className="text-sm text-slate-500">{e.venue} · {e.status}</p>
            </div>
            <Link href={`/admin/events/${e.id}`} className="btn-secondary btn-sm">Manage</Link>
          </div>
        ))}
        {events.length === 0 && (
          <div className="card p-10 text-center text-slate-400">No events yet. <Link href="/admin/events/new" className="text-brand-600 hover:underline">Create one.</Link></div>
        )}
      </div>
    </div>
  );
}
