import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import { listParticipants } from "@/lib/services/events";
import { decryptIdentity } from "@/lib/services/registrations";
import { formatInZone } from "@/lib/time";
import { clsx } from "clsx";
import Link from "next/link";
import { Download } from "lucide-react";
import type { RegistrationRow } from "@/lib/types";
import ParticipantFilters from "./ParticipantFilters";

export const metadata: Metadata = { title: "Participants" };

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission("participants.view");
  const sp = await searchParams;
  const eventId = sp.event ?? "";
  const q = sp.q ?? "";
  const section = sp.section ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? 1));

  const { events } = await listAllEvents(1, 100);
  const activeEventId = eventId || events[0]?.id || "";
  const activeEvent = events.find((e) => e.id === activeEventId);

  let rows: import("@/lib/types").RegistrationRow[] = [];
  let total = 0;
  if (activeEventId) {
    const result = await listParticipants({
      eventId: activeEventId,
      q: q || undefined,
      section: section || undefined,
      status: status || undefined,
      page,
      pageSize: 25,
      sort: "registered_at",
      dir: "desc",
    });
    rows = result.rows;
    total = result.total;
  }

  const STATUS_CLASS: Record<string, string> = {
    absent: "badge-gray",
    checked_in: "badge-blue",
    completed: "badge-green",
    cancelled: "badge-red",
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Participants</h1>
          <p className="text-slate-500 text-sm">{total.toLocaleString()} registrations</p>
        </div>
        {activeEventId && (
          <a
            href={`/api/reports/export?eventId=${activeEventId}`}
            className="btn-secondary btn-sm gap-2"
            download
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        )}
      </div>

      {/* Filters */}
      <ParticipantFilters
        events={events}
        activeEventId={activeEventId}
        q={q}
        section={section}
        status={status}
      />

      {(() => {
        const tz = activeEvent?.timezone ?? "UTC";
        const items = rows.map((reg: RegistrationRow & { attendance_records?: { time_in_at?: string; time_out_at?: string; status?: string }[] }) => {
          let name = "—";
          try { name = decryptIdentity(reg).fullName; } catch {}
          const att = reg.attendance_records?.[0];
          const attStatus = reg.registration_status === "cancelled" ? "cancelled" : (att?.status ?? "absent");
          const t = (iso?: string) => (iso ? formatInZone(iso, tz, { timeStyle: "short" }) : "—");
          return { reg, name, att, attStatus, timeIn: t(att?.time_in_at), timeOut: t(att?.time_out_at) };
        });
        const label = (s: string) => ({ absent: "Not arrived", checked_in: "Checked in", completed: "Completed", cancelled: "Cancelled" })[s] ?? s;
        return (
          <div className="card overflow-hidden">
            {/* Phone: card list */}
            <ul className="sm:hidden divide-y divide-[#eef4f3]">
              {items.length === 0 && <li className="py-10 text-center text-sm text-[#4b6362]">No registrations found.</li>}
              {items.map(({ reg, name, attStatus, timeIn, timeOut }) => (
                <li key={reg.id}>
                  <Link href={`/admin/participants/${reg.id}`} prefetch={true} className="flex items-center gap-3 px-4 py-3 active:bg-[#f3f7f6]">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink truncate">{name}</p>
                      <p className="text-xs text-[#4b6362]"><span className="font-mono">{reg.reference_code}</span> · {reg.section}</p>
                      <p className="text-xs text-[#4b6362] mt-0.5">In {timeIn} · Out {timeOut}</p>
                    </div>
                    <span className={clsx("badge shrink-0", STATUS_CLASS[attStatus] ?? "badge-gray")}>{label(attStatus)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Tablet & desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="table-auto w-full">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Section</th>
                    <th>Time in</th>
                    <th>Time out</th>
                    <th>Status</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-[#4b6362]">No registrations found.</td></tr>
                  )}
                  {items.map(({ reg, name, attStatus, timeIn, timeOut }) => (
                    <tr key={reg.id}>
                      <td>
                        <div className="font-semibold text-ink">{name}</div>
                        <div className="text-xs text-[#4b6362] font-mono">{reg.reference_code}</div>
                      </td>
                      <td className="text-[#4b6362]">{reg.section}</td>
                      <td className="text-xs text-[#4b6362] whitespace-nowrap">{timeIn}</td>
                      <td className="text-xs text-[#4b6362] whitespace-nowrap">{timeOut}</td>
                      <td><span className={clsx("badge whitespace-nowrap", STATUS_CLASS[attStatus] ?? "badge-gray")}>{label(attStatus)}</span></td>
                      <td>
                        <Link href={`/admin/participants/${reg.id}`} prefetch={true} className="text-brand-600 text-sm font-semibold hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        {total > 25 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#eef4f3] text-sm text-[#4b6362]">
            <span>Page {page} of {Math.ceil(total / 25)}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?${new URLSearchParams({ event: activeEventId, q, section, status, page: String(page - 1) })}`} prefetch={true} className="btn-secondary">← Prev</Link>
              )}
              {page < Math.ceil(total / 25) && (
                <Link href={`?${new URLSearchParams({ event: activeEventId, q, section, status, page: String(page + 1) })}`} prefetch={true} className="btn-primary">Next →</Link>
              )}
            </div>
          </div>
        )}
          </div>
        );
      })()}
    </div>
  );
}
