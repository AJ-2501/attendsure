import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = { title: "Student sign in", robots: { index: false } };

export default async function StudentLoginPage({ searchParams }: { searchParams: Promise<{ created?: string; next?: string }> }) {
  const { created, next } = await searchParams;
  return (
    <AuthShell role="student" title="Student sign in" subtitle="See your QR pass and your time-in and time-out records." tagline="Your attendance, assured.">
      {created && (
        <div role="status" className="text-sm font-semibold text-success-700 bg-success-50 rounded-xl px-3 py-2.5">
          Account created. Sign in with your new password.
        </div>
      )}
      <SignInForm expect="student" redirectTo="/me" next={next} emailPlaceholder="you@nursing.edu.ph" />
      <div className="rounded-2xl border border-[#dce7e5] bg-[#f3f7f6] p-4 text-sm text-[#23403f] flex flex-col gap-2">
        <p className="font-semibold text-ink">New here?</p>
        <p>Register for an event and create your account in one step. Your QR pass appears on your dashboard right away.</p>
        <Link href="/register" className="btn-primary w-full mt-1">Register &amp; create account</Link>
        <Link href="/student/signup" className="text-center text-[13px] font-semibold text-brand-600 hover:underline underline-offset-2 min-h-11 inline-flex items-center justify-center">
          Already registered without an account? Use your reference code
        </Link>
      </div>
    </AuthShell>
  );
}
