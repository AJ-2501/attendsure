import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { formatInZone } from "@/lib/time";
import DecryptClient from "./DecryptClient";

export const metadata: Metadata = { title: "Decrypt Records" };

type DecryptLog = {
  id: string;
  reason: string | null;
  metadata: { requested?: number; decrypted?: number; decrypted_by?: string };
  created_at: string;
  profiles: { display_name: string | null } | null;
};

export default async function DecryptPage() {
  const [, { data: recent }] = await Promise.all([
    requirePagePermission("records.decrypt"),
    createAdminClient()
      .from("attendance_audit_logs")
      .select("id, reason, metadata, created_at, profiles(display_name)")
      .eq("action", "records.decrypt")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<DecryptLog[]>(),
  ]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">Decrypt Records</h1>
        <p className="text-sm text-[#4b6362] max-w-2xl">
          Exports keep names and student IDs encrypted. Upload an export or paste encrypted values to reveal them.
          Every decryption is recorded with your name and reason.
        </p>
      </div>

      <DecryptClient />

      <section className="card overflow-hidden" aria-labelledby="recent-decrypts">
        <h2 id="recent-decrypts" className="px-4 py-3 border-b border-[#eef4f3] font-semibold text-ink">Recent decryptions</h2>
        {!recent?.length ? (
          <p className="px-4 py-8 text-center text-sm text-[#4b6362]">No decryptions yet.</p>
        ) : (
          <ul className="divide-y divide-[#eef4f3]">
            {recent.map((r) => {
              const account = r.profiles?.display_name ?? null;
              const person = r.metadata.decrypted_by ?? account ?? "Unknown staff";
              return (
                <li key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                  <span className="text-xs text-[#4b6362] whitespace-nowrap sm:w-44 shrink-0">{formatInZone(r.created_at, "Asia/Manila")}</span>
                  <span className="sm:w-48 shrink-0 min-w-0">
                    <span className="block font-semibold text-ink truncate" title={person}>{person}</span>
                    {r.metadata.decrypted_by && account && account !== person && (
                      <span className="block text-xs text-[#4b6362] truncate" title={`Signed in as ${account}`}>via {account}</span>
                    )}
                  </span>
                  <span className="text-[#4b6362] flex-1 min-w-0 truncate" title={r.reason ?? undefined}>{r.reason ?? "—"}</span>
                  <span className="badge badge-gray shrink-0 self-start sm:self-auto">
                    {(r.metadata.decrypted ?? 0).toLocaleString()} of {(r.metadata.requested ?? 0).toLocaleString()} values
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
