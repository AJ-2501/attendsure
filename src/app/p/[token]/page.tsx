import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getParticipantByAccessToken } from "@/lib/services/registrations";
import { getTokenForCredential } from "@/lib/services/credentials";
import ParticipantClient from "./ParticipantClient";
import { getSessionProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "My Attendance – AttendSure",
    robots: { index: false, follow: false },
  };
}

export default async function ParticipantPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { from } = await searchParams;
  const view = await getParticipantByAccessToken(token);
  if (!view) notFound();

  // Re-derive the time-in token for display if not yet used.
  const timeInCred = view.credentials.find((c) => c.action === "time_in" && !c.used_at && !c.revoked_at);
  const timeInToken = timeInCred ? getTokenForCredential(timeInCred.id) : null;

  const data = {
    fullName: view.fullName,
    maskedStudentId: view.maskedStudentId,
    referenceCode: view.registration.reference_code,
    section: view.registration.section,
    yearLevel: view.registration.year_level ?? null,
    department: view.registration.department ?? null,
    registrationStatus: view.registration.registration_status,
    registeredAt: view.registration.registered_at,
    event: {
      name: view.event.name,
      venue: view.event.venue,
      starts_at: view.event.starts_at,
      ends_at: view.event.ends_at,
      timezone: view.event.timezone,
      allow_time_in: view.event.allow_time_in,
      allow_time_out: view.event.allow_time_out,
      time_out_qr_ttl_seconds: view.event.time_out_qr_ttl_seconds,
      time_out_opens_at: view.event.time_out_opens_at,
      time_out_closes_at: view.event.time_out_closes_at,
    },
    attendance: {
      timeInAt: view.attendance.time_in_at,
      timeOutAt: view.attendance.time_out_at,
      timeInRef: view.attendance.time_in_ref,
      timeOutRef: view.attendance.time_out_ref,
      status: view.attendance.status,
    },
    credentials: view.credentials.map((c) => ({
      id: c.id,
      action: c.action,
      expiresAt: c.expires_at,
      usedAt: c.used_at,
      revokedAt: c.revoked_at,
    })),
    timeInToken,
  };

  // Signed-in students always get a way back to their dashboard.
  const session = await getSessionProfile();
  const back = from === "me" || session?.role === "student" ? { href: "/me", label: "My dashboard" } : { href: "/#events", label: "Events" };
  return <ParticipantClient data={data} accessToken={token} back={back} />;
}
