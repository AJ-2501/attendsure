import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import { getEventStats } from "@/lib/services/attendance";
import { effectiveStatus, STATUS_LABEL, formatInZone } from "@/lib/time";
import { ChevronRight, ScanLine, Plus } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import DashboardRealtime from "./DashboardRealtime";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_CLASS: Record<string, string> = {
  ongoing: "badge-blue", open: "badge-green", upcoming: "badge-yellow",
  completed: "badge-gray", cancelled: "badge-red", draft: "badge-gray",
};

function ProgressRing({ pct }: { pct: number }) {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <svg role="img" aria-label={`${pct} percent checked in`} viewBox="0 0 96 96" className="w-24 h-24 shrink-0">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e1ecea" strokeWidth="10" />
      <circle
        cx="48" cy="48" r={r} fill="none" stroke="var(--color-brand-600)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 48 48)"
      />
      <text x="48" y="54" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--color-ink)">{pct}%</text>
    </svg>
  );
}

export default async function AdminDashboard() {
  await requirePagePermission("dashboard.view");
  const { events } = await listAllEvents(1, 10);
  const now = new Date();

  // Fetch stats for the most relevant event (ongoing > open > upcoming)
  const primary = events.find((e) => effectiveStatus(e, now) === "ongoing")
    ?? events.find((e) => effectiveStatus(e, now) === "open")
    ?? events[0];
  const stats = primary ? await getEventStats(primary.id) : null;
  const pct = stats && stats.registered > 0 ? Math.round((stats.timed_in / stats.registered) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-[#4b6362] text-sm mt-0.5">Live attendance overview</p>
        </div>
        <Link href="/admin/scanner" className="btn-primary hidden sm:inline-flex">
          <ScanLine className="w-4 h-4" /> Open scanner
        </Link>
      </div>

      {stats && primary && (
        <section className="space-y-3">
          <div className="card p-5 flex items-center gap-5 shadow-[0_8px_24px_rgb(11_46_47/0.08)]">
            <ProgressRing pct={pct} />
            <div className="min-w-0 flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide uppercase text-[#4b6362]">Checked in</span>
              <span className="text-[28px] font-extrabold leading-none text-ink">
                {stats.timed_in.toLocaleString()} <span className="text-base font-semibold text-[#4b6362]">/ {stats.registered.toLocaleString()}</span>
              </span>
              <span className="text-sm font-semibold text-ink truncate">{primary.name}</span>
              <Link href={`/admin/reports?event=${primary.id}`} className="text-sm font-semibold text-brand-600 inline-flex items-center gap-0.5 min-h-8">
                Full report <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
            <Stat label="Timed out" value={stats.timed_out} />
            <Stat label="Not arrived" value={stats.not_arrived} />
            <Stat label="Rejected" value={stats.rejected_scans} tone="danger" />
            <Stat label="Still inside" value={stats.checked_in} className="hidden lg:flex" />
            <Stat label="Accepted scans" value={stats.accepted_scans} className="hidden lg:flex" />
            <Stat label="Cancelled" value={stats.cancelled} className="hidden lg:flex" />
          </div>
        </section>
      )}

      {primary && <DashboardRealtime eventId={primary.id} />}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-ink">All events</h2>
          <Link href="/admin/events/new" className="btn-secondary btn-sm"><Plus className="w-4 h-4" /> New event</Link>
        </div>

        {/* Phone: tappable list */}
        <ul className="sm:hidden card divide-y divide-[#eef4f3] overflow-hidden">
          {events.map((e) => {
            const status = effectiveStatus(e, now);
            return (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className="flex items-center gap-3 px-4 py-3 min-h-16 active:bg-[#f3f7f6]">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate">{e.name}</p>
                    <p className="text-xs text-[#4b6362]">{formatInZone(e.starts_at, e.timezone, { dateStyle: "medium" })} · {e.venue}</p>
                  </div>
                  <span className={clsx("badge shrink-0", STATUS_CLASS[status] ?? "badge-gray")}>{STATUS_LABEL[status]}</span>
                  <ChevronRight className="w-4 h-4 text-[#4b6362] shrink-0" />
                </Link>
              </li>
            );
          })}
          {events.length === 0 && <li className="p-8 text-center text-sm text-[#4b6362]">No events yet.</li>}
        </ul>

        {/* Tablet & desktop: table */}
        <div className="hidden sm:block card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Capacity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const status = effectiveStatus(e, now);
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="font-semibold text-ink">{e.name}</div>
                        <div className="text-xs text-[#4b6362]">{e.venue}</div>
                      </td>
                      <td className="text-[#4b6362]">{formatInZone(e.starts_at, e.timezone, { dateStyle: "medium" })}</td>
                      <td>
                        <span className={clsx("badge", STATUS_CLASS[status] ?? "badge-gray")}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td className="text-[#4b6362]">{e.capacity.toLocaleString()}</td>
                      <td>
                        <Link href={`/admin/events/${e.id}`} className="text-brand-600 text-sm font-semibold hover:underline">Manage</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone, className }: { label: string; value: number; tone?: "danger"; className?: string }) {
  return (
    <div className={clsx("card p-3 flex flex-col gap-0.5", className)}>
      <span className={clsx("text-[22px] font-extrabold leading-tight", tone === "danger" && value > 0 ? "text-danger-600" : "text-ink")}>
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-[#4b6362]">{label}</span>
    </div>
  );
}
