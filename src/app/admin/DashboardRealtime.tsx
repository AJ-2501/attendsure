"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACTION_LABEL, message } from "@/lib/messages";
import { CheckCircle, XCircle, Activity, Wifi, WifiOff } from "lucide-react";
import { clsx } from "clsx";

interface Scan {
  id: string;
  action: "time_in" | "time_out";
  result: "accepted" | "rejected";
  result_code: string;
  created_at: string;
}

interface Props { eventId: string; }

export default function DashboardRealtime({ eventId }: Props) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event_scans:${eventId}`)
      .on<Scan>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_attempts", filter: `event_id=eq.${eventId}` },
        (payload) => setScans((prev) => [payload.new, ...prev].slice(0, 25)),
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Live Scan Feed</h2>
        <span className={clsx("flex items-center gap-1.5 text-xs font-medium", connected ? "text-success-600" : "text-slate-400")}>
          {connected ? <><Wifi className="w-3.5 h-3.5" /> Live</> : <><WifiOff className="w-3.5 h-3.5" /> Connecting…</>}
        </span>
      </div>

      {scans.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Waiting for scans…</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scans.map((s) => (
            <div key={s.id} className={clsx("flex items-center gap-3 rounded-xl px-4 py-3 border animate-fade-up",
              s.result === "accepted"
                ? "bg-success-50 border-success-500/20"
                : "bg-danger-50 border-danger-500/20"
            )}>
              {s.result === "accepted"
                ? <CheckCircle className="w-5 h-5 text-success-600 shrink-0" />
                : <XCircle className="w-5 h-5 text-danger-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className={clsx("text-sm font-medium", s.result === "accepted" ? "text-success-700" : "text-danger-600")}>
                  {ACTION_LABEL[s.action]} — {message(s.result_code)}
                </p>
                <p className="text-xs text-slate-400">{new Date(s.created_at).toLocaleTimeString()}</p>
              </div>
              <span className={clsx("badge shrink-0", s.result === "accepted" ? "badge-green" : "badge-red")}>
                {s.result === "accepted" ? "Accepted" : "Rejected"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
