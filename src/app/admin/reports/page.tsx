import type { Metadata } from "next";
import EventPicker from "../EventPicker";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import { getEventStats, getSectionBreakdown, getAuditLog } from "@/lib/services/attendance";
import { formatInZone } from "@/lib/time";
import { BarChart2, Download } from "lucide-react";
import Link from "next/link";
import ReportsCharts from "./ReportsCharts";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("reports.view");
  const sp = await searchParams;
  const { events } = await listAllEvents(1, 50);
  const eventId = sp.event ?? events[0]?.id ?? "";
  const activeEvent = events.find((e) => e.id === eventId);

  const [stats, sectionBreakdown, deptBreakdown, yearBreakdown] = await Promise.all([
    eventId ? getEventStats(eventId) : null,
    eventId ? getSectionBreakdown(eventId, "section") : [],
    eventId ? getSectionBreakdown(eventId, "department") : [],
    eventId ? getSectionBreakdown(eventId, "year_level") : [],
  ]);

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Attendance Reports</h1>
          {activeEvent && <p className="text-slate-500 text-sm">{activeEvent.name}</p>}
        </div>
        {eventId && (
          <a href={`/api/reports/export?eventId=${eventId}`} download className="btn-secondary btn-sm gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </a>
        )}
      </div>

      {/* Event selector */}
      <EventPicker events={events} value={eventId} />

      {stats && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Registered", value: stats.registered },
              { label: "Timed In", value: stats.timed_in },
              { label: "Timed Out", value: stats.timed_out },
              { label: "Attendance Rate", value: `${stats.registered > 0 ? Math.round(stats.timed_in / stats.registered * 100) : 0}%` },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <span className="stat-value text-slate-900">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Charts */}
          <ReportsCharts sectionData={sectionBreakdown} deptData={deptBreakdown} yearData={yearBreakdown} />
        </>
      )}

      {!stats && <div className="card p-12 text-center text-slate-400"><BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Select an event to view reports.</p></div>}
    </div>
  );
}
