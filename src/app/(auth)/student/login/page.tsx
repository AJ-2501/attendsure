import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = { title: "Student sign in", robots: { index: false } };

export default async function StudentLoginPage({ searchParams }: { searchParams: Promise<{ created?: string; next?: string; event?: string }> }) {
  const { created, next, event } = await searchParams;
  const redirectTarget = next ?? (event ? `/me?register=${encodeURIComponent(event)}` : undefined);
  return (
    <AuthShell role="student" title="Student sign in" subtitle="See your QR pass and your time-in and time-out records.">
      {created && (
        <div role="status" className="text-sm font-semibold text-success-700 bg-success-50 rounded-xl px-3 py-2.5">
          Account created. Sign in with your new password.
        </div>
      )}
      <SignInForm expect="student" redirectTo="/me" next={redirectTarget} emailPlaceholder="initialssurname.student@ua.edu.ph" />
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#7a9391]" aria-hidden="true">
        <span className="h-px flex-1 bg-[#dce7e5]" /> or <span className="h-px flex-1 bg-[#dce7e5]" />
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 text-sm text-[#23403f] flex flex-col gap-2">
        <span className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-mint/20 blur-2xl" aria-hidden="true" />
        <p className="relative font-bold text-ink">New here?</p>
        <p className="relative">Register for an event and create your account in one step. Your QR pass appears on your dashboard right away.</p>
        <Link href={event ? `/student/signup?event=${encodeURIComponent(event)}` : "/student/signup"} className="btn-secondary relative w-full mt-1 border-brand-200 text-brand-700 hover:border-brand-400">Register</Link>
        <Link href="/student/signup" className="relative text-center text-[13px] font-semibold text-brand-600 hover:underline underline-offset-2 min-h-11 inline-flex items-center justify-center">
          Already registered without an account? Use your reference code
        </Link>
      </div>
    </AuthShell>
  );
}
