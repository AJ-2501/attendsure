import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { getSessionProfile } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import { getPublishedEvent } from "@/lib/services/events";
import { registrationPhase } from "@/lib/time";
import SignupForm from "./SignupForm";

export const metadata: Metadata = { title: "Create student account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StudentSignupPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event: eventId } = await searchParams;
  const session = await getSessionProfile();
  if (session && !isStaffRole(session.role)) redirect(eventId ? `/me?register=${encodeURIComponent(eventId)}` : "/me");

  const ev = eventId ? await getPublishedEvent(eventId) : null;
  const event = ev && registrationPhase(ev) === "open" ? { id: ev.id, name: ev.name } : null;
  const loginHref = `/student/login${event ? `?next=${encodeURIComponent(`/me?register=${event.id}`)}` : ""}`;

  return (
    <AuthShell role="student" title="Create your student account" subtitle="Sign up once. Get a QR pass for any event with one tap.">
      <SignupForm event={event} />
      <p className="text-[13px] text-center text-[#4b6362]">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2">Sign in</Link>
      </p>
    </AuthShell>
  );
}
