import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell role="admin" title="Admin sign in" subtitle="For clinical instructors, coordinators and scanner staff.">
      <SignInForm
        redirectTo="/admin"
        emailPlaceholder="name@nursing.edu.ph"
        initialError={error === "not_staff" ? "This account does not have admin access." : null}
      />
      <p className="text-[13px] text-center text-[#4b6362]">
        Forgot your password? Contact the College of Nursing office.
        <br />
        Student nurse?{" "}
        <Link href="/student/login" className="font-semibold text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline">
          Go to student sign in
        </Link>
      </p>
    </AuthShell>
  );
}
