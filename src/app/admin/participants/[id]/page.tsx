import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/services/events";
import { decryptIdentity, maskStudentId } from "@/lib/services/registrations";
import { getCredentialStatus } from "@/lib/services/credentials";
import { formatInZone } from "@/lib/time";
import type { AttendanceRow, RegistrationRow } from "@/lib/types";

export const metadata: Metadata = { title: "Participant" };

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_CLASS: Record<string, string> = {
  absent: "badge-gray",
  checked_in: "badge-blue",
  completed: "badge-green",
  cancelled: "badge-red",
};

export default async function ParticipantDetailPage({ params }: Props) {
  await requirePagePermission("participants.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = createAdminClient();
  const { data: reg } = await db.from("registrations").select("*").eq("id", id).maybeSingle<RegistrationRow>();
  if (!reg) notFound();

  const [event, { data: att }, credentials] = await Promise.all([
    getEventById(reg.event_id),
    db.from("attendance_records").select("*").eq("registration_id", reg.id).maybeSingle<AttendanceRow>(),
    getCredentialStatus(reg.id),
  ]);
  const tz = event?.timezone ?? "UTC";

  let fullName = "(unable to decrypt)";
  let studentId = "—";
  try {
    const identity = decryptIdentity(reg);
    fullName = identity.fullName;
    studentId = maskStudentId(identity.studentId);
  } catch {}

  const status = reg.registration_status === "cancelled" ? "cancelled" : (att?.status ?? "absent");
  const rows: [string, React.ReactNode][] = [
    ["Event", event?.name ?? "—"],
    ["Reference", <span key="ref" className="font-mono">{reg.reference_code}</span>],
    ["Student ID", <span key="sid" className="font-mono">{studentId}</span>],
    ["Section", reg.section],
    ["Year Level", reg.year_level ?? "—"],
    ["Department", reg.department ?? "—"],
    ["Registered", formatInZone(reg.registered_at, tz)],
    ["Time In", formatInZone(att?.time_in_at, tz)],
    ["Time In Ref", att?.time_in_ref ?? "—"],
    ["Time Out", formatInZone(att?.time_out_at, tz)],
    ["Time Out Ref", att?.time_out_ref ?? "—"],
  ];
  if (reg.cancelled_reason) rows.push(["Cancellation Reason", reg.cancelled_reason]);

  return (
    <div className="space-y-6 animate-fade-up max-w-2xl">
      <Link href={`/admin/participants?event=${reg.event_id}`} prefetch={true} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to participants
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
        <span className={clsx("badge", STATUS_CLASS[status] ?? "badge-gray")}>{status.replace("_", " ")}</span>
      </div>

      <div className="card p-6">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-medium text-slate-900">QR Credentials</div>
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Action</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {credentials.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">No credentials issued.</td></tr>
              )}
              {credentials.map((c) => (
                <tr key={c.id}>
                  <td className="text-sm">{c.action.replace("_", " ")}</td>
                  <td className="text-xs text-slate-500">{formatInZone(c.created_at, tz)}</td>
                  <td className="text-xs text-slate-500">{formatInZone(c.expires_at, tz)}</td>
                  <td className="text-xs">
                    {c.revoked_at ? "Revoked" : c.used_at ? `Used ${formatInZone(c.used_at, tz)}` : "Active"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
