import type { Metadata } from "next";
import EventPicker from "../EventPicker";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import { getAuditLog } from "@/lib/services/attendance";
import { formatInZone } from "@/lib/time";
import Link from "next/link";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const pageOf = (sp: Record<string, string | undefined>) => Math.max(1, Number(sp.page ?? 1));
  // Auth, the event list and (with ?event=) that event's log all load in one parallel batch.
  const [, sp, { events }, early] = await Promise.all([
    requirePagePermission("audit.view"),
    searchParams,
    listAllEvents(1, 50),
    searchParams.then((sp) => (sp.event ? getAuditLog(sp.event, pageOf(sp), 25) : null)),
  ]);
  const page = pageOf(sp);
  const eventId = sp.event ?? events[0]?.id ?? "";
  const activeEvent = events.find((e) => e.id === eventId);

  const { rows, total } = early ?? (eventId ? await getAuditLog(eventId, page, 25) : { rows: [], total: 0 });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">Audit Log</h1>
        <p className="text-slate-500 text-sm">{total.toLocaleString()} records</p>
      </div>

      <EventPicker events={events} value={eventId} />

      <div className="card overflow-hidden">
        {/* Phone: stacked entries */}
        <ul className="sm:hidden divide-y divide-[#eef4f3]">
          {rows.length === 0 && <li className="py-10 text-center text-sm text-slate-400">No audit records.</li>}
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded truncate">{r.action}</span>
                <span className="text-xs text-slate-500 shrink-0">{formatInZone(r.created_at, activeEvent?.timezone ?? "UTC")}</span>
              </div>
              {r.reason && <p className="text-sm text-slate-600 break-words">{r.reason}</p>}
              <details className="text-xs">
                <summary className="cursor-pointer text-brand-600 font-semibold min-h-11 flex items-center">Metadata</summary>
                <pre className="bg-slate-50 rounded p-2 text-slate-600 text-xs overflow-auto max-h-48">{JSON.stringify(r.metadata, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ul>
        {/* Tablet & desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Reason</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-slate-400">No audit records.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs text-slate-500 whitespace-nowrap">
                    {formatInZone(r.created_at, activeEvent?.timezone ?? "UTC")}
                  </td>
                  <td>
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{r.action}</span>
                  </td>
                  <td className="text-sm text-slate-500 max-w-xs truncate">{r.reason ?? "—"}</td>
                  <td>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-brand-600 hover:underline">Metadata</summary>
                      <pre className="mt-1 bg-slate-50 rounded p-2 text-slate-600 text-xs overflow-auto max-w-xs">
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 25 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>Page {page} of {Math.ceil(total / 25)}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`?event=${eventId}&page=${page - 1}`} prefetch={true} className="btn-secondary btn-sm">← Prev</Link>}
              {page < Math.ceil(total / 25) && <Link href={`?event=${eventId}&page=${page + 1}`} prefetch={true} className="btn-primary btn-sm">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
