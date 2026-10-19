import type { Metadata } from "next";
import { Suspense } from "react";
import { listPublishedEvents, countRegistrations, toPublicEvent } from "@/lib/services/events";
import { effectiveStatus, registrationPhase } from "@/lib/time";
import Link from "next/link";
import { ArrowDown, ShieldCheck, UserRound } from "lucide-react";
import { Logo, EcgLine } from "@/components/Brand";
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
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#dce7e5] pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <nav aria-label="Sign in" className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login" className="btn-ghost px-3 text-[#23403f]">Admin</Link>
            <Link href="/student/login" className="btn-primary px-3.5 sm:px-4">
              <UserRound className="w-4 h-4" aria-hidden="true" /> Student login
            </Link>
          </nav>
        </div>
      </header>

      <section className="monitor-grid text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6 sm:pt-16 grid lg:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-bold tracking-[0.08em] uppercase text-mint">College of Nursing</p>
            <h1 className="text-[28px] sm:text-5xl font-extrabold leading-[1.15] tracking-tight">
              Register once.
              <br />
              Check in with one scan.
            </h1>
            <p className="text-[15px] sm:text-lg leading-relaxed text-[#a7c9c6] max-w-lg">
              Pick an event, get your personal QR pass, and show it at the door.
            </p>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap gap-3 mt-2">
              <Link href="#events" className="btn-primary btn-lg">
                View events <ArrowDown className="w-5 h-5" aria-hidden="true" />
              </Link>
              <Link href="/student/signup" className="btn btn-lg border border-white/25 text-white hover:bg-white/10">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" /> Create student account
              </Link>
            </div>
            {openCount > 0 && (
              <Link href="/?filter=open#events" className="self-start text-sm font-semibold text-mint hover:underline underline-offset-4 min-h-11 inline-flex items-center">
                {openCount} event{openCount === 1 ? "" : "s"} open for registration →
              </Link>
            )}
          </div>
          <EcgLine className="w-full h-auto opacity-90" />
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <h2 id="events" className="scroll-mt-20 text-xl sm:text-2xl font-bold text-ink mb-4">Events</h2>
        <Suspense fallback={<div className="card h-40 animate-pulse" />}>
          <EventBrowser items={items} />
        </Suspense>
      </main>
    </div>
  );
}
