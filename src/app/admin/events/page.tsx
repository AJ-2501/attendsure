import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { CalendarPlus, CheckCircle2, ExternalLink, MapPin, Pencil, Plus, Users } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { countRegistrations, listAllEvents } from "@/lib/services/events";
import { effectiveStatus, formatInZone, formatTimeRange, STATUS_BADGE, STATUS_LABEL } from "@/lib/time";
import DeleteEventButton from "./DeleteEventButton";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requirePagePermission("events.manage");
  const { deleted } = await searchParams;
  const { events, total } = await listAllEvents(1, 100);
  const counts = await countRegistrations(events.map((e) => e.id));
  const now = new Date();

  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-fade-up">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Events</h1>
          <p className="text-sm text-[#4b6362]">{total.toLocaleString()} event{total === 1 ? "" : "s"} · newest first</p>
        </div>
        <Link href="/admin/events/new" className="btn-primary">
          <Plus className="w-4 h-4" aria-hidden="true" /> New event
        </Link>
      </div>

      {deleted && (
        <div role="status" className="scan-accepted text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Event deleted. The deletion was recorded in the audit log.
        </div>
      )}

      {events.length === 0 ? (
        <div className="card p-10 text-center flex flex-col items-center gap-2 text-[#4b6362]">
          <CalendarPlus className="w-10 h-10 text-brand-300" aria-hidden="true" />
          <p className="font-bold text-ink">No events yet</p>
          <Link href="/admin/events/new" className="btn-primary mt-2">Create your first event</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {events.map((e) => {
            const status = effectiveStatus(e, now);
            const reg = counts[e.id] ?? 0;
            const pct = e.capacity ? Math.min(100, Math.round((reg / e.capacity) * 100)) : 0;
            return (
              <li key={e.id} className="card p-4 flex gap-4 min-w-0">
                <div className="w-14 shrink-0 h-16 rounded-[14px] bg-brand-100 flex flex-col items-center justify-center" aria-hidden="true">
                  <span className="text-[11px] font-bold tracking-wider text-brand-700">{formatInZone(e.starts_at, e.timezone, { month: "short" }).toUpperCase()}</span>
                  <span className="text-[22px] font-extrabold leading-none text-ink">{formatInZone(e.starts_at, e.timezone, { day: "2-digit" })}</span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={clsx("badge", STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>
                    {e.status === "draft" && <span className="badge badge-gray">Hidden from students</span>}
                  </div>
                  <Link href={`/admin/events/${e.id}`} className="font-bold text-ink leading-snug hover:text-brand-700 break-words">{e.name}</Link>
                  <p className="text-[13px] text-[#4b6362]">{formatTimeRange(e.starts_at, e.ends_at, e.timezone)}</p>
                  <p className="text-[13px] text-[#4b6362] flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> <span className="truncate">{e.venue}</span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[#4b6362]">
                    <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="shrink-0">{reg.toLocaleString()} / {e.capacity.toLocaleString()}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-[#e1ecea] overflow-hidden" aria-hidden="true">
                      <span className="block h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Link href={`/admin/events/${e.id}`} className="btn-secondary flex-1">
                      <Pencil className="w-4 h-4" aria-hidden="true" /> Edit
                    </Link>
                    {e.status === "published" && (
                      <Link href={`/events/${e.id}`} target="_blank" className="btn-ghost w-11 h-11 p-0" aria-label={`Open public page for ${e.name}`}>
                        <ExternalLink className="w-[18px] h-[18px]" />
                      </Link>
                    )}
                    <DeleteEventButton eventId={e.id} eventName={e.name} registrations={reg} variant="icon" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
