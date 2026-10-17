import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import { getAuditLog } from "@/lib/services/attendance";
import { formatInZone } from "@/lib/time";
import Link from "next/link";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("audit.view");
  const sp = await searchParams;
  const { events } = await listAllEvents(1, 50);
  const eventId = sp.event ?? events[0]?.id ?? "";
  const page = Math.max(1, Number(sp.page ?? 1));
  const activeEvent = events.find((e) => e.id === eventId);

  const { rows, total } = eventId ? await getAuditLog(eventId, page, 25) : { rows: [], total: 0 };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-500 text-sm">{total.toLocaleString()} records</p>
      </div>

      <form className="flex gap-3" method="GET">
        <select name="event" defaultValue={eventId} className="input max-w-xs">
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button type="submit" className="btn-primary btn-sm">View</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>Page {page} of {Math.ceil(total / 25)}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`?event=${eventId}&page=${page - 1}`} className="btn-secondary btn-sm">← Prev</Link>}
              {page < Math.ceil(total / 25) && <Link href={`?event=${eventId}&page=${page + 1}`} className="btn-primary btn-sm">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
