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

export const metadata: Metadata = { title: "Participants" };

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await requirePagePermission("participants.view");
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
          <h1 className="text-2xl font-bold text-slate-900">Participants</h1>
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
      <form className="card p-4 flex flex-wrap gap-3" method="GET">
        <input type="hidden" name="event" value={activeEventId} />
        <select name="event" className="input max-w-[200px]" defaultValue={activeEventId}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Name or reference…" className="input max-w-[180px]" />
        <input name="section" defaultValue={section} placeholder="Section…" className="input max-w-[120px]" />
        <select name="status" className="input max-w-[140px]" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="absent">Not arrived</option>
          <option value="checked_in">Checked in</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button type="submit" className="btn-primary btn-sm">Filter</button>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Section</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">No registrations found.</td></tr>
              )}
              {rows.map((reg: RegistrationRow & { attendance_records?: { time_in_at?: string; time_out_at?: string; status?: string }[] }) => {
                let name = "—";
                try { name = decryptIdentity(reg).fullName; } catch {}
                const att = reg.attendance_records?.[0];
                const attStatus = att?.status ?? "absent";
                return (
                  <tr key={reg.id}>
                    <td>
                      <div className="font-medium text-slate-900">{name}</div>
                      <div className="text-xs text-slate-400 font-mono">{reg.reference_code}</div>
                    </td>
                    <td className="text-slate-500">{reg.section}</td>
                    <td className="text-xs text-slate-500">
                      {att?.time_in_at ? formatInZone(att.time_in_at, activeEvent?.timezone ?? "UTC", { timeStyle: "short" }) : "—"}
                    </td>
                    <td className="text-xs text-slate-500">
                      {att?.time_out_at ? formatInZone(att.time_out_at, activeEvent?.timezone ?? "UTC", { timeStyle: "short" }) : "—"}
                    </td>
                    <td>
                      <span className={clsx("badge", STATUS_CLASS[attStatus] ?? "badge-gray")}>
                        {attStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <Link href={`/admin/participants/${reg.id}`} className="text-brand-600 text-xs hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total > 25 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>Page {page} of {Math.ceil(total / 25)}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?event=${activeEventId}&q=${q}&section=${section}&status=${status}&page=${page - 1}`} className="btn-secondary btn-sm">← Prev</Link>
              )}
              {page < Math.ceil(total / 25) && (
                <Link href={`?event=${activeEventId}&q=${q}&section=${section}&status=${status}&page=${page + 1}`} className="btn-primary btn-sm">Next →</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
