import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignupForm from "./SignupForm";

export const metadata: Metadata = { title: "Create student account", robots: { index: false } };

export default function StudentSignupPage() {
  return (
    <AuthShell role="student" title="Create your student account" subtitle="Link your account to your student ID to track your attendance." tagline="Your attendance, assured.">
      <SignupForm />
      <p className="text-[13px] text-center text-[#4b6362]">
        Already have an account?{" "}
        <Link href="/student/login" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2">Sign in</Link>
      </p>
    </AuthShell>
  );
}
