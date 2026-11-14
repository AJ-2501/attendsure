import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, UserPlus } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { googleAuthError } from "@/lib/auth/google";

export const metadata: Metadata = { title: "Student sign in", robots: { index: false } };

export default async function StudentLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; event?: string }> }) {
  const { error, next, event } = await searchParams;
  const redirectTarget = next ?? (event ? `/me?register=${encodeURIComponent(event)}` : undefined);
  // Keep the event the student came for, so "Register" lands on that event's form.
  const eventId = event ?? redirectTarget?.match(/^\/me\?register=([0-9a-f-]{36})$/i)?.[1];
  const registerHref = eventId ? `/student/signup?event=${encodeURIComponent(eventId)}` : "/student/signup";
  const notRegistered = error === "not_registered";
  const errorMessage = notRegistered ? null : googleAuthError(error);
  return (
    <AuthShell role="student" title="Student sign in" subtitle="See your QR pass and your time-in and time-out records.">
      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-500/20 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}
      {notRegistered && (
        <section
          role="alert"
          aria-labelledby="not-registered-title"
          className="relative overflow-hidden rounded-2xl border border-warning-500/40 bg-warning-50 p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-white ring-1 ring-warning-500/40 flex items-center justify-center text-warning-600" aria-hidden="true">
              <UserPlus className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 id="not-registered-title" className="font-bold text-ink">Register first to sign in</h2>
              <p className="mt-0.5 text-sm leading-relaxed text-[#23403f]">
                This Google account isn&apos;t registered yet. Add your student details once, then continue with the same Google account. It takes about a minute.
              </p>
            </div>
          </div>
          <Link href={registerHref} className="btn-primary btn-lg w-full">
            Register now <ArrowRight className="w-[18px] h-[18px]" aria-hidden="true" />
          </Link>
        </section>
      )}
      <div className="flex flex-col gap-3">
        {notRegistered && <p className="text-[13px] text-center text-[#4b6362]">Already registered with a different account?</p>}
        <GoogleSignInButton next={redirectTarget} />
      </div>
      {!notRegistered && (
        <>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#7a9391]" aria-hidden="true">
            <span className="h-px flex-1 bg-[#dce7e5]" /> or <span className="h-px flex-1 bg-[#dce7e5]" />
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 text-sm text-[#23403f] flex flex-col gap-2">
            <span className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-mint/20 blur-2xl" aria-hidden="true" />
            <p className="relative font-bold text-ink">New here?</p>
            <p className="relative">Register for an event and create your account in one step. Your QR pass appears on your dashboard right away.</p>
            <Link href={registerHref} className="btn-secondary relative w-full mt-1 border-brand-200 text-brand-700 hover:border-brand-400">Register</Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
