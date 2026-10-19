import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { CalendarDays, CheckCircle2, Circle, Clock, MapPin, ShieldCheck, AlertTriangle, XCircle, LogIn, LogOut, CalendarPlus } from "lucide-react";
import { requireStudentPage } from "@/lib/auth/session";
import { getStudentDashboard, type StudentEventRecord } from "@/lib/services/students";
import { formatInZone, formatTimeRange } from "@/lib/time";
import { Logo } from "@/components/Brand";
import { AutoRefresh, OpenPassButton, RefreshButton, SignOutButton } from "./StudentControls";
import { openPass } from "./actions";

export const metadata: Metadata = { title: "My attendance", robots: { index: false } };
export const dynamic = "force-dynamic";

type Verdict = { key: "complete" | "active" | "incomplete" | "absent" | "pending" | "cancelled"; label: string; tone: string; icon: typeof CheckCircle2 };

function verdict(r: StudentEventRecord, now: number): Verdict {
  const a = r.attendance;
  const ended = now >= Date.parse(r.event.ends_at);
  const needsOut = r.event.allow_time_out && r.event.require_time_out;
  if (r.registrationStatus === "cancelled") return { key: "cancelled", label: "Registration cancelled", tone: "badge-gray", icon: XCircle };
  if (a?.time_in_at && (a.time_out_at || !needsOut)) return { key: "complete", label: "Attendance complete", tone: "badge-green", icon: ShieldCheck };
  if (a?.time_in_at && !ended) return { key: "active", label: "Timed in · time out pending", tone: "badge-blue", icon: Clock };
  if (a?.time_in_at) return { key: "incomplete", label: "No time-out recorded", tone: "badge-yellow", icon: AlertTriangle };
  if (ended) return { key: "absent", label: "No time-in recorded", tone: "badge-red", icon: XCircle };
  return { key: "pending", label: "Not timed in yet", tone: "badge-gray", icon: Circle };
}

function Step({ icon: Icon, label, at, refCode, tz, enabled }: { icon: typeof LogIn; label: string; at: string | null | undefined; refCode: string | null | undefined; tz: string; enabled: boolean }) {
  const done = Boolean(at);
  return (
    <div className={clsx("rounded-2xl border p-3 flex flex-col gap-1 min-w-0", done ? "bg-success-50 border-success-500/30" : "bg-white border-[#dce7e5]")}>
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#4b6362]">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
      </span>
      {!enabled ? (
        <span className="text-sm font-semibold text-[#4b6362]">Not required</span>
      ) : done ? (
        <>
          <span className="flex items-center gap-1.5 text-base font-bold text-success-700">
            <CheckCircle2 className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            {formatInZone(at, tz, { timeStyle: "short" })}
          </span>
          <span className="text-xs text-[#4b6362]">{formatInZone(at, tz, { dateStyle: "medium" })}</span>
          {refCode && <span className="font-mono text-[11px] text-[#23403f] truncate" title="Confirmation reference">Ref {refCode}</span>}
        </>
      ) : (
        <span className="text-base font-bold text-ink">Not yet</span>
      )}
    </div>
  );
}

function RecordCard({ r, now }: { r: StudentEventRecord; now: number }) {
  const v = verdict(r, now);
  const tz = r.event.timezone;
  const ended = now >= Date.parse(r.event.ends_at);
  const VIcon = v.icon;
  return (
    <article className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-ink leading-snug">
            <Link href={`/events/${r.event.id}`} className="hover:text-brand-700">{r.event.name}</Link>
          </h3>
          <p className="mt-0.5 text-[13px] text-[#4b6362] flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {formatInZone(r.event.starts_at, tz, { dateStyle: "medium" })} · {formatTimeRange(r.event.starts_at, r.event.ends_at, tz)}
          </p>
          <p className="text-[13px] text-[#4b6362] flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> <span className="truncate">{r.event.venue}</span>
          </p>
        </div>
      </div>
      <span className={clsx("badge self-start", v.tone)}>
        <VIcon className="w-3.5 h-3.5" aria-hidden="true" /> {v.label}
      </span>
      <div className="grid grid-cols-2 gap-2.5">
        <Step icon={LogIn} label="Time in" at={r.attendance?.time_in_at} refCode={r.attendance?.time_in_ref} tz={tz} enabled={r.event.allow_time_in} />
        <Step icon={LogOut} label="Time out" at={r.attendance?.time_out_at} refCode={r.attendance?.time_out_ref} tz={tz} enabled={r.event.allow_time_out} />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-[#4b6362]">
        <span>Registration <span className="font-mono text-[#23403f]">{r.referenceCode}</span></span>
        <span>{r.section}</span>
      </div>
      {!ended && r.registrationStatus === "registered" && v.key !== "complete" && (
        <form action={openPass}>
          <input type="hidden" name="registrationId" value={r.registrationId} />
          <OpenPassButton />
        </form>
      )}
    </article>
  );
}

export default async function StudentDashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const student = await requireStudentPage();
  const { error } = await searchParams;
  const data = await getStudentDashboard(student.profileId);
  const now = new Date().getTime();
  const verdicts = data.records.map((r) => verdict(r, now).key);
  const count = (k: Verdict["key"]) => verdicts.filter((v) => v === k).length;
  const live = data.records.filter((r) => now >= Date.parse(r.event.starts_at) && now < Date.parse(r.event.ends_at) && r.registrationStatus === "registered");
  const firstName = (data.fullName ?? student.displayName ?? "").split(" ")[0];

  const upcoming = data.records.filter((r) => now < Date.parse(r.event.ends_at)).sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
  const past = data.records.filter((r) => now >= Date.parse(r.event.ends_at));

  return (
    <div className="min-h-dvh pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <AutoRefresh />
      <header className="bg-ink text-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="sm" tone="dark" />
          <div className="flex items-center">
            <RefreshButton />
            <SignOutButton />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pt-2 pb-12">
          <p className="text-sm text-[#a7c9c6]">My attendance</p>
          <h1 className="text-[26px] font-extrabold leading-tight">{firstName ? `Hi, ${firstName}` : "Welcome"}</h1>
          {data.maskedStudentId && <p className="font-mono text-sm text-[#a7c9c6] mt-0.5">ID {data.maskedStudentId}</p>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-8 flex flex-col gap-5">
        {error && (
          <div role="alert" className="scan-rejected text-sm font-semibold">
            {error === "rate" ? "Too many requests. Please wait a few minutes." : "Couldn't open that pass. Refresh and try again."}
          </div>
        )}

        {!data.linked ? (
          <div className="card p-6 text-center flex flex-col items-center gap-2">
            <ShieldCheck className="w-10 h-10 text-brand-300" aria-hidden="true" />
            <p className="font-bold text-ink">This account isn&apos;t linked to a student ID.</p>
            <p className="text-sm text-[#4b6362]">Please create your account from the student sign-up page using your student ID and reference code.</p>
            <Link href="/student/signup" className="btn-primary mt-2">Link my student ID</Link>
          </div>
        ) : (
          <>
            {/* Summary */}
            <section aria-label="Summary" className="card p-4 grid grid-cols-3 divide-x divide-[#eef4f3] text-center shadow-[0_8px_24px_rgb(11_46_47/0.08)]">
              <div className="px-1">
                <p className="text-2xl font-extrabold text-success-700">{count("complete")}</p>
                <p className="text-xs text-[#4b6362]">Complete</p>
              </div>
              <div className="px-1">
                <p className="text-2xl font-extrabold text-brand-700">{count("active") + count("pending")}</p>
                <p className="text-xs text-[#4b6362]">In progress</p>
              </div>
              <div className="px-1">
                <p className={clsx("text-2xl font-extrabold", count("incomplete") + count("absent") > 0 ? "text-danger-600" : "text-ink")}>{count("incomplete") + count("absent")}</p>
                <p className="text-xs text-[#4b6362]">Needs attention</p>
              </div>
            </section>

            {live.length > 0 && (
              <section aria-labelledby="now" className="flex flex-col gap-3">
                <h2 id="now" className="flex items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase text-coral">
                  <span className="w-2 h-2 rounded-full bg-coral blink-soft" aria-hidden="true" /> Happening now
                </h2>
                {live.map((r) => <RecordCard key={r.registrationId} r={r} now={now} />)}
              </section>
            )}

            {data.records.length === 0 && (
              <div className="card p-8 text-center flex flex-col items-center gap-2">
                <CalendarPlus className="w-10 h-10 text-brand-300" aria-hidden="true" />
                <p className="font-bold text-ink">No registrations yet</p>
                <p className="text-sm text-[#4b6362]">Register for an event and it will appear here automatically.</p>
                <Link href="/#events" className="btn-primary mt-2">Browse events</Link>
              </div>
            )}

            {upcoming.filter((r) => !live.includes(r)).length > 0 && (
              <section aria-labelledby="upcoming" className="flex flex-col gap-3">
                <h2 id="upcoming" className="text-xs font-bold tracking-[0.08em] uppercase text-[#4b6362]">Upcoming</h2>
                {upcoming.filter((r) => !live.includes(r)).map((r) => <RecordCard key={r.registrationId} r={r} now={now} />)}
              </section>
            )}

            {past.length > 0 && (
              <section aria-labelledby="history" className="flex flex-col gap-3">
                <h2 id="history" className="text-xs font-bold tracking-[0.08em] uppercase text-[#4b6362]">Attendance history</h2>
                {past.map((r) => <RecordCard key={r.registrationId} r={r} now={now} />)}
              </section>
            )}

            <p className="text-center text-xs text-[#4b6362]">
              Times are recorded by the scanner and can&apos;t be edited by you. Keep your reference codes as proof of attendance.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
