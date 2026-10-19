import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = { title: "Student sign in", robots: { index: false } };

export default async function StudentLoginPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  return (
    <AuthShell role="student" title="Student sign in" subtitle="See your time-in and time-out records for every event." tagline="Your attendance, assured.">
      {created && (
        <div role="status" className="text-sm font-semibold text-success-700 bg-success-50 rounded-xl px-3 py-2.5">
          Account created. Sign in with your new password.
        </div>
      )}
      <SignInForm redirectTo="/me" emailPlaceholder="you@nursing.edu.ph" />
      <div className="rounded-2xl border border-[#dce7e5] bg-[#f3f7f6] p-4 text-sm text-[#23403f] flex flex-col gap-2">
        <p className="font-semibold text-ink">First time here?</p>
        <p>Register for an event first, then create your account with your student ID and the reference code you received.</p>
        <Link href="/student/signup" className="btn-secondary w-full mt-1">Create student account</Link>
      </div>
    </AuthShell>
  );
}
