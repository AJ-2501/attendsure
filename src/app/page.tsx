import type { Metadata } from "next";
import { Suspense } from "react";
import { listPublishedEvents, countPublishedRegistrations, toPublicEvent } from "@/lib/services/events";
import { effectiveStatus, registrationPhase } from "@/lib/time";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, BadgeCheck, LockKeyhole, QrCode, ScanLine, ShieldCheck, UserRound, Zap } from "lucide-react";
import { Logo } from "@/components/Brand";
import SealScene from "@/components/SealScene";
import EventBrowser, { type EventItem } from "@/components/EventBrowser";
import JumpToEvents from "@/components/JumpToEvents";
import SiteFooter from "@/components/SiteFooter";

// Event status depends on the current time and new events must appear immediately.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AttendSure – College of Nursing and Pharmacy Attendance",
  description: "Register for College of Nursing and Pharmacy events and get your personal QR attendance pass with AttendSure.",
};

export default async function HomePage() {
  const now = new Date();
  // Keep past events from the last 60 days only, so the "Past" tab stays relevant.
  const cutoff = now.getTime() - 60 * 86_400_000;
  // Events and their registration counts load in parallel (counts filter by event in the database).
  const [events, registered] = await Promise.all([listPublishedEvents(), countPublishedRegistrations(new Date(cutoff).toISOString())]);
  const items: EventItem[] = events
    .filter((e) => Date.parse(e.ends_at) >= cutoff)
    .map((e) => ({ event: toPublicEvent(e), status: effectiveStatus(e, now), regPhase: registrationPhase(e, now), registered: registered[e.id] ?? 0 }));
  const openCount = items.filter((i) => i.regPhase === "open" && i.status !== "completed").length;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="seal-hairline sticky top-0 z-20 bg-white/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <nav aria-label="Sign in" className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login" prefetch={true} className="btn-ghost px-3 text-[#23403f]">Admin</Link>
            <Link href="/student/login" prefetch={true} className="btn-primary px-3.5 sm:px-4 shadow-[0_6px_16px_-6px_oklch(0.51_0.086_186/0.6)]">
              <UserRound className="w-4 h-4" aria-hidden="true" />
              {/* Shorter label on the narrowest phones so the header never overflows. */}
              <span className="max-[359px]:hidden">Student login</span>
              <span className="min-[360px]:hidden">Log in</span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="hero-aurora hero-photo relative text-white overflow-hidden">
        {/* Campus photo: high-res, centered focal point on mobile, wide architectural view on desktop */}
        <Image
          src="/images/campus-hero.jpg"
          alt=""
          fill
          priority
          quality={90}
          sizes="(min-width: 1536px) 1536px, 100vw"
          className="absolute inset-0 object-cover object-[50%_60%] lg:object-center select-none pointer-events-none"
        />
        {/* Contrast scrim: dark emerald-teal gradient for text clarity and focus */}
        <div className="hero-photo-scrim absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8 sm:pt-16 sm:pb-12 grid lg:grid-cols-[1.15fr_1fr] gap-6 items-center">
          <div className="flex flex-col gap-4 animate-fade-up">
            <p className="seal-pill self-start inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-bold tracking-[0.08em] uppercase text-white">
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-seal-green-glow" aria-hidden="true" />
              College of Nursing and Pharmacy
            </p>
            <h1 className="text-[30px] sm:text-5xl lg:text-[50px] font-extrabold leading-[1.1] tracking-tight text-balance">
              Register once.
              <br />
              <span className="text-gradient-seal">Check in with one scan.</span>
            </h1>
            <p className="text-[15px] sm:text-lg leading-relaxed text-[#b5d3d0] max-w-lg">
              Pick an event, get your personal QR pass, and show it at the door.
            </p>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap gap-3 mt-1">
              <JumpToEvents className="btn-primary btn-lg shadow-[0_10px_30px_-10px_rgb(45_212_191/0.7)]">
                View events <ArrowDown className="w-5 h-5" aria-hidden="true" />
              </JumpToEvents>
              <Link href="/student/signup" prefetch={true} className="btn btn-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" /> Create student account
              </Link>
            </div>
            {openCount > 0 && (
              <JumpToEvents filter="open" className="self-start text-sm font-semibold text-mint hover:underline underline-offset-4 min-h-11 inline-flex items-center">
                {openCount} event{openCount === 1 ? "" : "s"} open for registration →
              </JumpToEvents>
            )}
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-[13px] text-[#9fc2bf]">
              <li className="inline-flex items-center gap-1.5"><LockKeyhole className="w-4 h-4 text-mint/80" aria-hidden="true" /> Encrypted QR passes</li>
              <li className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4 text-mint/80" aria-hidden="true" /> Instant check-in</li>
              <li className="inline-flex items-center gap-1.5"><BadgeCheck className="w-4 h-4 text-mint/80" aria-hidden="true" /> Verified attendance</li>
            </ul>
          </div>

          {/* Decorative: 3D CONP seal medallion with floating pass/check-in chips */}
          <div className="relative h-[340px] sm:h-[420px] lg:h-[480px]" aria-hidden="true">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] max-w-[360px] aspect-square rounded-full bg-[radial-gradient(circle,rgb(208_176_242/0.22),rgb(127_220_171/0.10)_45%,transparent_70%)] blur-2xl" />
            <SealScene className="absolute inset-0" />
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

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-12 sm:pb-16">
        <div className="mb-5 flex flex-col gap-1">
          <p className="self-start text-xs font-bold tracking-[0.08em] uppercase text-gradient-seal-ink">Calendar</p>
          <h2 id="events" tabIndex={-1} className="scroll-mt-24 outline-none text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">Events</h2>
          <p className="text-sm sm:text-[15px] text-[#4b6362]">Browse College of Nursing and Pharmacy events.</p>
        </div>
        <Suspense fallback={<div className="card h-40 animate-pulse" />}>
          <EventBrowser items={items} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
