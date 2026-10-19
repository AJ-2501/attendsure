import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import StaffRegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Register" };
export const dynamic = "force-dynamic";

/**
 * Entry point for every "Register" button:
 *  - signed-out visitors create their student account (and register for the event) in one form;
 *  - signed-in students confirm the event on their dashboard with one tap;
 *  - staff get the manual form for walk-in registrations.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const eventQs = event && /^[0-9a-f-]{36}$/i.test(event) ? event : null;
  const session = await getSessionProfile();
  if (!session) redirect(`/student/signup${eventQs ? `?event=${eventQs}` : ""}`);
  if (!isStaffRole(session.role)) redirect(`/me${eventQs ? `?register=${eventQs}` : "#open-events"}`);
  return <StaffRegisterForm />;
}
