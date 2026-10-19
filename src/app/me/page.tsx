import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { CalendarDays, CheckCircle2, Circle, Clock, MapPin, ShieldCheck, AlertTriangle, XCircle, LogIn, LogOut, CalendarPlus, PartyPopper } from "lucide-react";
import { requireStudentPage } from "@/lib/auth/session";
import { getStudentDashboard, type StudentEventRecord } from "@/lib/services/students";
import { formatInZone, formatTimeRange } from "@/lib/time";
import { Logo } from "@/components/Brand";
import { AutoRefresh, ClaimForm, OpenPassButton, QrImage, RefreshButton, SignOutButton, TimeOutPass } from "./StudentControls";
import { openPass } from "./actions";

export const metadata: Metadata = { title: "My attendance", robots: { index: false } };
export const dynamic = "force-dynamic";

type VerdictKey = "complete" | "active" | "incomplete" | "absent" | "pending" | "cancelled";
type Verdict = { key: VerdictKey; label: string; tone: string; icon: typeof CheckCircle2 };

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

/** What the student should do right now for this event, with the right QR. */
function PassPanel({ r, now }: { r: StudentEventRecord; now: number }) {
  const tz = r.event.timezone;
  const a = r.attendance;
  const fmt = (iso: string) => formatInZone(iso, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (r.registrationStatus !== "registered") return null;

  if (!a?.time_in_at && r.event.allow_time_in) {
    const opens = Date.parse(r.event.time_in_opens_at);
    const closes = Date.parse(r.event.time_in_closes_at);
    if (now >= closes) return null;
    return (
      <div className="rounded-2xl bg-[#f3f7f6] p-4 flex flex-col items-center gap-3 text-center">
        <p className="font-bold text-ink flex items-center gap-2"><LogIn className="w-4 h-4 text-brand-600" aria-hidden="true" /> Time-in pass</p>
        {r.timeInToken ? <QrImage token={r.timeInToken} label="Time in" /> : <p className="text-sm text-[#4b6362]">Your time-in pass isn&apos;t available. Ask the event staff to reissue it.</p>}
        <p className={clsx("text-sm", now < opens ? "font-semibold text-[#8a4b06]" : "text-[#23403f]")}>
          {now < opens ? `Scanning opens ${fmt(r.event.time_in_opens_at)}` : `Show this to staff at the door · until ${fmt(r.event.time_in_closes_at)}`}
        </p>
      </div>
    );
  }

  if (a?.time_in_at && !a.time_out_at && r.event.allow_time_out) {
    const opens = Date.parse(r.timeOutWindow.opens);
    const closes = Date.parse(r.timeOutWindow.closes);
    if (now >= closes) return null;
    return (
      <div className="rounded-2xl bg-[#f3f7f6] p-4 flex flex-col items-center gap-3 text-center">
        <p className="font-bold text-ink flex items-center gap-2"><LogOut className="w-4 h-4 text-brand-600" aria-hidden="true" /> Time-out pass</p>
        {now < opens ? (
          <p className="text-sm font-semibold text-[#8a4b06]">Time-out opens {fmt(r.timeOutWindow.opens)}. Come back then to get your QR.</p>
        ) : (
          <>
            <div className="w-full"><TimeOutPass registrationId={r.registrationId} initial={r.timeOut} /></div>
            <p className="text-xs text-[#4b6362]">Generate it when you&apos;re ready to leave. Time-out closes {fmt(r.timeOutWindow.closes)}.</p>
          </>
        )}
      </div>
    );
  }
  return null;
}

function RecordCard({ r, now, highlight }: { r: StudentEventRecord; now: number; highlight?: boolean }) {
  const v = verdict(r, now);
  const tz = r.event.timezone;
  const ended = now >= Date.parse(r.event.ends_at);
  const VIcon = v.icon;
  return (
    <article className={clsx("card p-4 flex flex-col gap-3", highlight && "ring-2 ring-brand-400")}>
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
      <span className={clsx("badge self-start", v.tone)}>
        <VIcon className="w-3.5 h-3.5" aria-hidden="true" /> {v.label}
      </span>

      <PassPanel r={r} now={now} />

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

export default async function StudentDashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; registered?: string }> }) {
  const student = await requireStudentPage();
  const { error, registered } = await searchParams;
  const data = await getStudentDashboard(student.profileId);
  const now = new Date().getTime();
  const verdicts = data.records.map((r) => verdict(r, now).key);
  const count = (k: VerdictKey) => verdicts.filter((v) => v === k).length;
  const firstName = (data.fullName ?? student.displayName ?? "").split(" ")[0];

  const current = data.records
    .filter((r) => now < Date.parse(r.event.ends_at) + 2 * 3600_000 && r.registrationStatus === "registered")
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
  const past = data.records.filter((r) => !current.includes(r));
  const showingQr = current.some((r) => r.timeInToken || r.timeOut || (r.attendance?.time_in_at && !r.attendance.time_out_at));

  return (
    <div className="min-h-dvh pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <AutoRefresh fast={showingQr} />
      <header className="bg-ink text-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" aria-label="AttendSure home"><Logo size="sm" tone="dark" /></Link>
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
        {registered && (
          <div role="status" className="card p-4 flex items-start gap-3 border-success-500/30 bg-success-50">
            <PartyPopper className="w-5 h-5 text-success-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-[#0e4d33]">
              <p className="font-bold">You&apos;re registered!</p>
              <p>Your QR pass is below. Reference code <span className="font-mono font-semibold">{registered}</span>.</p>
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="scan-rejected text-sm font-semibold">
            {error === "rate" ? "Too many requests. Please wait a few minutes." : "Couldn't open that pass. Refresh and try again."}
          </div>
        )}

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

        {data.records.length === 0 && (
          <div className="card p-8 text-center flex flex-col items-center gap-2">
            <CalendarPlus className="w-10 h-10 text-brand-300" aria-hidden="true" />
            <p className="font-bold text-ink">No registrations yet</p>
            <p className="text-sm text-[#4b6362]">Register for an event and your QR pass will appear here.</p>
            <Link href="/register" className="btn-primary mt-2">Register for an event</Link>
          </div>
        )}

        {current.length > 0 && (
          <section aria-labelledby="current" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="current" className="text-xs font-bold tracking-[0.08em] uppercase text-[#4b6362]">Your passes</h2>
              <Link href="/register" className="text-sm font-semibold text-brand-600 min-h-11 inline-flex items-center">+ Register for another</Link>
            </div>
            {current.map((r) => <RecordCard key={r.registrationId} r={r} now={now} highlight={r.referenceCode === registered} />)}
          </section>
        )}

        {past.length > 0 && (
          <section aria-labelledby="history" className="flex flex-col gap-3">
            <h2 id="history" className="text-xs font-bold tracking-[0.08em] uppercase text-[#4b6362]">Attendance history</h2>
            {past.map((r) => <RecordCard key={r.registrationId} r={r} now={now} />)}
          </section>
        )}

        <ClaimForm defaultOpen={data.records.length === 0} />

        <p className="text-center text-xs text-[#4b6362]">
          Times are recorded by the scanner and can&apos;t be edited by you. Keep your reference codes as proof of attendance.
        </p>
      </main>
    </div>
  );
}
