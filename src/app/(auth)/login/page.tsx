import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <AuthShell role="admin" title="Admin sign in" subtitle="For Coordinators, Instructors, Officers.">
      <SignInForm
        expect="staff"
        redirectTo="/admin"
        next={next}
        emailPlaceholder="initialssurname.student@ua.edu.ph"
        initialError={error === "not_staff" ? "Incorrect email or password." : null}
      />
      <p className="text-[13px] text-center text-[#4b6362]">
        Forgot your password? Contact the College of Nursing office.
      </p>
    </AuthShell>
  );
}
