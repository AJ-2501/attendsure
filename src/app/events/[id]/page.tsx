import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { CalendarDays, ChevronLeft, Clock, MapPin, Building2, LogIn, LogOut, ClipboardEdit, QrCode, ScanLine } from "lucide-react";
import { getPublishedEvent, countRegistrations } from "@/lib/services/events";
import { effectiveStatus, formatInZone, formatTimeRange, registrationPhase, STATUS_BADGE, STATUS_LABEL, timeOutWindow, zoneAbbrev } from "@/lib/time";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getPublishedEvent((await params).id);
  return event
    ? { title: event.name, description: `${event.name} · ${event.venue}` }
    : { title: "Event not found" };
}

function Window({ icon, label, opens, closes, tz, active, last }: { icon: React.ReactNode; label: string; opens: string; closes: string; tz: string; active: boolean; last?: boolean }) {
  const sameDay = formatInZone(opens, tz, { dateStyle: "medium" }) === formatInZone(closes, tz, { dateStyle: "medium" });
  return (
    <li className={clsx("relative flex gap-3", !last && "pb-5")}>
      {!last && <span className="absolute left-[19px] top-10 bottom-0 w-px bg-[#dce7e5]" aria-hidden="true" />}
      <span className={clsx("w-10 h-10 rounded-full flex items-center justify-center shrink-0", active ? "bg-brand-600 text-white" : "bg-[#e1ecea] text-[#23403f]")}>
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold text-ink flex items-center gap-2">
          {label}
          {active && <span className="badge badge-green">Now</span>}
        </p>
        <p className="text-sm text-[#4b6362]">
          {formatInZone(opens, tz)} – {sameDay ? formatInZone(closes, tz, { timeStyle: "short" }) : formatInZone(closes, tz)}
        </p>
      </div>
    </li>
  );
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await getPublishedEvent(id);
  if (!event) notFound();

  const now = new Date();
  const t = now.getTime();
  const status = effectiveStatus(event, now);
  const registered = (await countRegistrations([event.id]))[event.id] ?? 0;
  const full = registered >= event.capacity;
  const phase = registrationPhase(event, now);
  const canRegister = phase === "open" && status !== "completed" && !full;
  const tz = event.timezone;
  const out = timeOutWindow(event);
  const within = (a: string, b: string) => t >= Date.parse(a) && t < Date.parse(b);

  const cta = canRegister
    ? null
    : status === "completed"
      ? "This event has ended"
      : phase === "before"
        ? `Registration opens ${formatInZone(event.registration_opens_at, tz)}`
        : status === "cancelled"
          ? "This event was cancelled"
          : full
            ? "This event is fully booked"
            : "Registration is closed";

  return (
    <div className="min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-ink text-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto h-14 px-2 flex items-center gap-1">
          <Link href="/#events" prefetch={true} aria-label="Back to events" className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-white/10">
            <ChevronLeft className="w-[22px] h-[22px]" />
          </Link>
          <span className="text-[15px] font-semibold truncate">Event details</span>
        </div>
      </header>

      <section className="monitor-grid text-white">
        <div className="max-w-3xl mx-auto px-5 pt-4 pb-10 flex flex-col gap-3">
          <span className={clsx("badge self-start", STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>
          <h1 className="text-[26px] sm:text-4xl font-extrabold leading-tight tracking-tight">{event.name}</h1>
          <div className="flex flex-col gap-1.5 text-[15px] text-[#cfe3e0]">
            <p className="flex items-center gap-2"><CalendarDays className="w-[18px] h-[18px] shrink-0 text-mint" aria-hidden="true" />{formatInZone(event.starts_at, tz, { dateStyle: "full" })}</p>
            <p className="flex items-center gap-2"><Clock className="w-[18px] h-[18px] shrink-0 text-mint" aria-hidden="true" />{formatTimeRange(event.starts_at, event.ends_at, tz)} <span className="text-[#a7c9c6]">({zoneAbbrev(tz, new Date(event.starts_at))})</span></p>
            <p className="flex items-center gap-2"><MapPin className="w-[18px] h-[18px] shrink-0 text-mint" aria-hidden="true" />{event.venue}</p>
            {event.organizer && <p className="flex items-center gap-2"><Building2 className="w-[18px] h-[18px] shrink-0 text-mint" aria-hidden="true" />{event.organizer}</p>}
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 -mt-5 flex flex-col gap-4 relative">

        {event.description && (
          <section className="card p-5" aria-labelledby="about">
            <h2 id="about" className="font-bold text-ink mb-2">About this event</h2>
            <p className="text-[15px] leading-relaxed text-[#23403f] whitespace-pre-line">{event.description}</p>
          </section>
        )}

        <section className="card p-5" aria-labelledby="schedule">
          <h2 id="schedule" className="font-bold text-ink mb-4">Schedule</h2>
          <ol>
            <Window icon={<ClipboardEdit className="w-[18px] h-[18px]" />} label="Registration" opens={event.registration_opens_at} closes={event.registration_closes_at} tz={tz} active={within(event.registration_opens_at, event.registration_closes_at)} last={!event.allow_time_in && !event.allow_time_out} />
            {event.allow_time_in && (
              <Window icon={<LogIn className="w-[18px] h-[18px]" />} label="Time in at the door" opens={event.time_in_opens_at} closes={event.time_in_closes_at} tz={tz} active={within(event.time_in_opens_at, event.time_in_closes_at)} last={!event.allow_time_out} />
            )}
            {event.allow_time_out && (
              <Window icon={<LogOut className="w-[18px] h-[18px]" />} label="Time out" opens={out.opens} closes={out.closes} tz={tz} active={within(out.opens, out.closes)} last />
            )}
          </ol>
        </section>

        <section className="card p-5" aria-labelledby="how">
          <h2 id="how" className="font-bold text-ink mb-4">How attendance works</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: ClipboardEdit, title: "Register", text: "Fill in your name, student ID and section." },
              { icon: QrCode, title: "Get your QR pass", text: "Save the private link you receive — it holds your pass." },
              { icon: ScanLine, title: "Scan at the door", text: "Show your pass to staff to time in and time out." },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex sm:flex-col gap-3 rounded-2xl bg-[#f3f7f6] p-3.5">
                <span className="w-10 h-10 rounded-xl bg-white text-brand-600 flex items-center justify-center shrink-0 border border-[#dce7e5]">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink"><span className="text-brand-600">{i + 1}.</span> {title}</p>
                  <p className="text-sm text-[#4b6362]">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      {/* Sticky action bar — always within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-[#dce7e5] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {canRegister ? (
            <Link href={`/register?event=${event.id}`} prefetch={true} className="btn-primary btn-lg w-full">Register for this event</Link>
          ) : (
            <p className="min-h-[3.25rem] flex items-center justify-center text-center text-sm font-semibold text-[#4b6362] rounded-[0.875rem] bg-[#f3f7f6] px-4">{cta}</p>
          )}
        </div>
      </div>
    </div>
  );
}
