import type { Metadata } from "next";
import { Suspense } from "react";
import { listPublishedEvents, countRegistrations, toPublicEvent } from "@/lib/services/events";
import { effectiveStatus, registrationPhase } from "@/lib/time";
import Link from "next/link";
import { ArrowDown, BadgeCheck, LockKeyhole, QrCode, ScanLine, ShieldCheck, UserRound, Zap } from "lucide-react";
import { Logo } from "@/components/Brand";
import CaduceusScene from "@/components/CaduceusScene";
import EventBrowser, { type EventItem } from "@/components/EventBrowser";

// Event status depends on the current time and new events must appear immediately.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AttendSure – College of Nursing Attendance",
  description: "Register for College of Nursing events and get your personal QR attendance pass with AttendSure.",
};

export default async function HomePage() {
  const events = await listPublishedEvents();
  const now = new Date();

  const registered = await countRegistrations(events.map((e) => e.id));
  // Keep past events from the last 60 days only, so the "Past" tab stays relevant.
  const cutoff = now.getTime() - 60 * 86_400_000;
  const items: EventItem[] = events
    .filter((e) => Date.parse(e.ends_at) >= cutoff)
    .map((e) => ({ event: toPublicEvent(e), status: effectiveStatus(e, now), regPhase: registrationPhase(e, now), registered: registered[e.id] ?? 0 }));
  const openCount = items.filter((i) => i.regPhase === "open" && i.status !== "completed").length;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-[#dce7e5]/80 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <nav aria-label="Sign in" className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login" className="btn-ghost px-3 text-[#23403f]">Admin</Link>
            <Link href="/student/login" className="btn-primary px-3.5 sm:px-4 shadow-[0_6px_16px_-6px_oklch(0.51_0.086_186/0.6)]">
              <UserRound className="w-4 h-4" aria-hidden="true" /> Student login
            </Link>
          </nav>
        </div>
      </header>

      <section className="hero-aurora text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8 sm:pt-16 sm:pb-12 grid lg:grid-cols-[1.15fr_1fr] gap-6 items-center">
          <div className="flex flex-col gap-4 animate-fade-up">
            <p className="self-start inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/10 px-3 py-1 text-[12px] font-bold tracking-[0.08em] uppercase text-mint">
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-mint" aria-hidden="true" />
              College of Nursing
            </p>
            <h1 className="text-[30px] sm:text-5xl lg:text-[50px] font-extrabold leading-[1.1] tracking-tight text-balance">
              Register once.
              <br />
              <span className="text-gradient-mint">Check in with one scan.</span>
            </h1>
            <p className="text-[15px] sm:text-lg leading-relaxed text-[#b5d3d0] max-w-lg">
              Pick an event, get your personal QR pass, and show it at the door.
            </p>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap gap-3 mt-1">
              <Link href="#events" className="btn-primary btn-lg shadow-[0_10px_30px_-10px_rgb(45_212_191/0.7)]">
                View events <ArrowDown className="w-5 h-5" aria-hidden="true" />
              </Link>
              <Link href="/student/signup" className="btn btn-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" /> Create student account
              </Link>
            </div>
            {openCount > 0 && (
              <Link href="/?filter=open#events" className="self-start text-sm font-semibold text-mint hover:underline underline-offset-4 min-h-11 inline-flex items-center">
                {openCount} event{openCount === 1 ? "" : "s"} open for registration →
              </Link>
            )}
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-[13px] text-[#9fc2bf]">
              <li className="inline-flex items-center gap-1.5"><LockKeyhole className="w-4 h-4 text-mint/80" aria-hidden="true" /> Encrypted QR passes</li>
              <li className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4 text-mint/80" aria-hidden="true" /> Instant check-in</li>
              <li className="inline-flex items-center gap-1.5"><BadgeCheck className="w-4 h-4 text-mint/80" aria-hidden="true" /> Verified attendance</li>
            </ul>
          </div>

          {/* Decorative: 3D gold caduceus with floating pass/check-in chips */}
          <div className="relative h-[340px] sm:h-[420px] lg:h-[480px]" aria-hidden="true">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] max-w-[360px] aspect-square rounded-full bg-[radial-gradient(circle,rgb(227_201_140/0.20),rgb(94_234_212/0.08)_45%,transparent_70%)] blur-2xl" />
            <CaduceusScene className="absolute inset-0" />
            <div className="glass-chip float-soft absolute left-0 lg:left-[2%] top-[3%] sm:top-[10%]">
              <span className="w-9 h-9 rounded-xl bg-[#e3c98c]/15 text-[#e3c98c] flex items-center justify-center"><QrCode className="w-5 h-5" /></span>
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] text-[#9fc2bf]">Your pass</span>
                <span className="text-sm font-bold">QR ready</span>
              </span>
            </div>
            <div className="glass-chip float-soft absolute right-0 lg:right-[2%] bottom-[3%] sm:bottom-[10%] [animation-delay:-3s]">
              <span className="w-9 h-9 rounded-xl bg-mint/15 text-mint flex items-center justify-center"><ScanLine className="w-5 h-5" /></span>
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] text-[#9fc2bf]">At the door</span>
                <span className="text-sm font-bold">Checked in</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="mb-5 flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.08em] uppercase text-brand-600">Calendar</p>
          <h2 id="events" className="scroll-mt-24 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">Events</h2>
          <p className="text-sm sm:text-[15px] text-[#4b6362]">Browse College of Nursing events and reserve your seat.</p>
        </div>
        <Suspense fallback={<div className="card h-40 animate-pulse" />}>
          <EventBrowser items={items} />
        </Suspense>
      </main>
    </div>
  );
}
