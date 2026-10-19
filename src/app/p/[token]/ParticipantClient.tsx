"use client";
import { useState, useEffect, useCallback } from "react";
import { formatInZone, timeOutWindow } from "@/lib/time";
import { ACTION_LABEL } from "@/lib/messages";
import { QrCode, Clock, CheckCircle, CalendarDays, MapPin, Loader2, LogIn, LogOut, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { Logo } from "@/components/Brand";

interface CredentialInfo {
  id: string;
  action: "time_in" | "time_out";
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
}

interface ParticipantData {
  fullName: string;
  maskedStudentId: string;
  referenceCode: string;
  section: string;
  yearLevel: string | null;
  department: string | null;
  registrationStatus: "registered" | "cancelled";
  registeredAt: string;
  event: {
    name: string;
    venue: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    allow_time_in: boolean;
    allow_time_out: boolean;
    time_out_qr_ttl_seconds: number;
    time_out_opens_at: string | null;
    time_out_closes_at: string | null;
  };
  attendance: {
    timeInAt: string | null;
    timeOutAt: string | null;
    timeInRef: string | null;
    timeOutRef: string | null;
    status: "absent" | "checked_in" | "completed";
  };
  credentials: CredentialInfo[];
  timeInToken: string | null;
}

interface QrDisplayProps {
  label: string;
  token: string;
  expiresAt: string | null;
  icon: React.ReactNode;
  color: "blue" | "green";
}

function QrDisplay({ label, token, expiresAt, icon, color }: QrDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(token, { width: 480, margin: 4, errorCorrectionLevel: "M", color: { dark: "#0b2e2f", light: "#ffffff" } })
        .then(setDataUrl);
    });
  }, [token]);

  useEffect(() => {
    if (!expiresAt) return;
    const check = () => setExpired(new Date(expiresAt) <= new Date());
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const textColor = color === "blue" ? "text-brand-700" : "text-success-700";

  return (
    <div className="card p-5 flex flex-col items-center gap-4 shadow-[0_8px_24px_rgb(11_46_47/0.08)]">
      <div className={clsx("flex items-center gap-2 font-bold", textColor)}>
        {icon} {label} pass
      </div>
      {expired ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
          <Clock className="w-10 h-10" />
          <p className="text-sm font-medium">QR Code Expired</p>
        </div>
      ) : dataUrl ? (
        <div className="rounded-2xl border-2 border-brand-600 p-3 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          <img src={dataUrl} alt={`${label} QR code`} width={240} height={240} className="w-[min(240px,64vw)] h-auto" />
        </div>
      ) : (
        <div className="flex items-center justify-center w-[min(240px,64vw)] aspect-square">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      )}
      {!expired && dataUrl && (
        <p className="flex items-center gap-2 text-sm font-semibold text-success-700">
          <span className="w-2.5 h-2.5 rounded-full bg-success-500" /> Ready to scan · turn up brightness
        </p>
      )}
      {expiresAt && (
        <p className={clsx("text-xs text-center", expired ? "text-danger-600" : "text-slate-500")}>
          {expired ? "Expired — please generate a new one" : `Expires: ${new Date(expiresAt).toLocaleTimeString()}`}
        </p>
      )}
    </div>
  );
}

export default function ParticipantClient({ data, accessToken, back }: { data: ParticipantData; accessToken: string; back: { href: string; label: string } }) {
  const [timeOutToken, setTimeOutToken] = useState<string | null>(null);
  const [timeOutExpiry, setTimeOutExpiry] = useState<string | null>(null);
  const [issuingTimeOut, setIssuingTimeOut] = useState(false);
  const [timeOutError, setTimeOutError] = useState<string | null>(null);

  const issueTimeOut = useCallback(async () => {
    setIssuingTimeOut(true);
    setTimeOutError(null);
    try {
      const res = await fetch(`/api/participant/timeout-qr?accessToken=${encodeURIComponent(accessToken)}`);
      const json = await res.json();
      if (json.ok) {
        setTimeOutToken(json.data.token);
        setTimeOutExpiry(json.data.expiresAt);
      } else {
        setTimeOutError(json.error?.message ?? "Could not issue QR code.");
      }
    } finally {
      setIssuingTimeOut(false);
    }
  }, [accessToken]);

  const att = data.attendance;
  const ev = data.event;
  const timeOutWindow_ = timeOutWindow({ starts_at: ev.starts_at, ends_at: ev.ends_at, time_out_opens_at: ev.time_out_opens_at, time_out_closes_at: ev.time_out_closes_at });
  const now = new Date();
  const canGetTimeOut =
    ev.allow_time_out &&
    att.timeInAt !== null &&
    att.timeOutAt === null &&
    now >= new Date(timeOutWindow_.opens) &&
    now < new Date(timeOutWindow_.closes);

  return (
    <div className="min-h-dvh bg-ink">
      <header className="max-w-xl mx-auto px-5 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-5 text-white">
        <div className="flex items-center justify-between gap-2 h-11 -ml-2">
          <Link href={back.href} className="min-h-11 pl-1 pr-3 rounded-xl inline-flex items-center gap-1 text-sm font-semibold hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" aria-hidden="true" /> {back.label}
          </Link>
          <span className="font-mono text-[13px] text-[#a7c9c6]">{data.referenceCode}</span>
        </div>
        <Logo size="sm" tone="dark" className="mt-2" />
        <p className="mt-3 text-[13px] text-[#a7c9c6]">Your pass for</p>
        <h1 className="text-[22px] font-extrabold leading-tight">{ev.name}</h1>
        <p className="mt-1 text-sm text-[#a7c9c6] flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 shrink-0" />
          {formatInZone(ev.starts_at, ev.timezone)} — {formatInZone(ev.ends_at, ev.timezone, { timeStyle: "short" })}
        </p>
        <p className="text-sm text-[#a7c9c6] flex items-center gap-1.5">
          <MapPin className="w-4 h-4 shrink-0" /> {ev.venue}
        </p>
      </header>

      <div className="bg-[#f3f7f6] rounded-t-[28px] min-h-[60dvh]">
      <div className="max-w-xl mx-auto px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 animate-sheet-up">
        {data.registrationStatus === "cancelled" && (
          <div className="scan-rejected text-sm font-semibold">This registration has been cancelled.</div>
        )}

        {/* QR codes */}
        {data.registrationStatus === "registered" && (
          <div className="space-y-4">

            {/* Time In QR */}
            {ev.allow_time_in && !att.timeInAt && data.timeInToken && (
              <QrDisplay
                label="Time In"
                token={data.timeInToken}
                expiresAt={null}
                icon={<LogIn className="w-4 h-4" />}
                color="blue"
              />
            )}
            {att.timeInAt && (
              <div className="card p-4 border border-success-500/20 bg-success-50 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success-600" />
                <div>
                  <p className="text-sm font-semibold text-success-700">Time In Recorded</p>
                  <p className="text-xs text-slate-500">{formatInZone(att.timeInAt, ev.timezone)} · {att.timeInRef}</p>
                </div>
              </div>
            )}

            {/* Time Out QR */}
            {ev.allow_time_out && !att.timeOutAt && (
              <>
                {timeOutToken ? (
                  <QrDisplay
                    label="Time Out"
                    token={timeOutToken}
                    expiresAt={timeOutExpiry}
                    icon={<LogOut className="w-4 h-4" />}
                    color="green"
                  />
                ) : (
                  <div className="card p-5 flex flex-col items-center gap-3">
                    <LogOut className="w-8 h-8 text-brand-300" />
                    <p className="text-sm text-slate-500 text-center">
                      {canGetTimeOut
                        ? `Your time-out QR will be valid for ${Math.round(ev.time_out_qr_ttl_seconds / 60)} minutes.`
                        : att.timeInAt === null
                        ? "Time-out QR is available after you time in."
                        : "Time-out scanning window is not yet open."}
                    </p>
                    {canGetTimeOut && (
                      <button onClick={issueTimeOut} disabled={issuingTimeOut} className="btn-primary btn-lg w-full">
                        {issuingTimeOut ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><QrCode className="w-4 h-4" /> Get Time-Out QR</>}
                      </button>
                    )}
                    {timeOutError && <p className="text-xs text-danger-600">{timeOutError}</p>}
                  </div>
                )}
              </>
            )}
            {att.timeOutAt && (
              <div className="card p-4 border border-success-500/20 bg-success-50 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success-600" />
                <div>
                  <p className="text-sm font-semibold text-success-700">Time Out Recorded</p>
                  <p className="text-xs text-slate-500">{formatInZone(att.timeOutAt, ev.timezone)} · {att.timeOutRef}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attendance status */}
        <div className="grid grid-cols-2 gap-3">
          {(["time_in", "time_out"] as const).map((action) => {
            const recorded = action === "time_in" ? att.timeInAt : att.timeOutAt;
            const ref = action === "time_in" ? att.timeInRef : att.timeOutRef;
            return (
              <div key={action} className={clsx("rounded-2xl border p-3.5 flex flex-col gap-1", recorded ? "bg-success-50 border-success-500/30" : "bg-white border-[#dce7e5]")}>
                <span className="text-xs font-bold tracking-wide uppercase text-[#4b6362]">{ACTION_LABEL[action]}</span>
                <span className={clsx("text-base font-bold", recorded ? "text-success-700" : "text-ink")}>
                  {recorded ? formatInZone(recorded, ev.timezone, { timeStyle: "short" }) : "Not yet"}
                </span>
                {ref && <span className="font-mono text-[11px] text-[#4b6362] truncate">{ref}</span>}
              </div>
            );
          })}
        </div>

        <div className="card p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-ink truncate">{data.fullName}</p>
            <p className="text-sm text-[#4b6362]">{data.maskedStudentId} · {data.section}</p>
            {data.yearLevel && <p className="text-xs text-[#4b6362]">{data.yearLevel}{data.department ? ` · ${data.department}` : ""}</p>}
          </div>
          <span className={clsx("badge shrink-0", data.registrationStatus === "registered" ? "badge-green" : "badge-red")}>
            {data.registrationStatus === "registered" ? "Registered" : "Cancelled"}
          </span>
        </div>

        <p className="text-center text-[13px] text-[#4b6362] pb-2">
          Bookmark this page — it is your private link.
        </p>
        <Link href={back.href} className="btn-secondary btn-lg w-full">
          <ChevronLeft className="w-5 h-5" aria-hidden="true" /> Back to {back.label.toLowerCase()}
        </Link>
      </div>
      </div>
    </div>
  );
}
