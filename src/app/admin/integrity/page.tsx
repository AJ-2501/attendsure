import type { Metadata } from "next";
import EventPicker from "../EventPicker";
import { requirePagePermission } from "@/lib/auth/session";
import { listAllEvents } from "@/lib/services/events";
import { getIntegrityFlags } from "@/lib/services/attendance";
import { ShieldAlert, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Integrity Monitor" };

export default async function IntegrityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("audit.view");
  const sp = await searchParams;
  const { events } = await listAllEvents(1, 50);
  const eventId = sp.event ?? events[0]?.id ?? "";
  const flags = eventId ? await getIntegrityFlags(eventId) : [];

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">Integrity Monitor</h1>
        <p className="text-slate-500 text-sm">Rule-based flags. Not evidence of wrongdoing.</p>
      </div>

      <EventPicker events={events} value={eventId} />

      {flags.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No suspicious activity detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((f, i) => (
            <div key={i} className="card p-4 border-l-4 border-warning-500 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">
                  Registration <span className="font-mono text-sm">{f.registration_id?.slice(0, 8)}…</span>
                </p>
                <p className="text-sm text-slate-500">
                  {f.count} rejected scan{f.count !== 1 ? "s" : ""} — last code: <span className="font-mono">{f.result_code}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
