"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ChevronDown, Clock, Loader2, LogOut, Plus, QrCode, RefreshCw, Save, Sun } from "lucide-react";
import { STUDENT_ID_EXAMPLE, YEAR_LEVELS } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { claimAction, requestTimeOutPass, saveProfileAction, type ClaimState, type ProfileState } from "./actions";

/**
 * Re-fetch attendance while the tab is visible so a scan shows up without reloading.
 * Faster while a QR is on screen (the student is likely standing at the scanner).
 */
export function AutoRefresh({ fast }: { fast: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, fast ? 6_000 : 30_000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, fast]);
  return null;
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" onClick={() => start(() => router.refresh())} className="w-11 h-11 rounded-xl flex items-center justify-center text-white hover:bg-white/10" aria-label="Refresh attendance">
      <RefreshCw className={pending ? "w-5 h-5 animate-spin" : "w-5 h-5"} />
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        router.replace("/student/login");
        router.refresh();
      }}
      className="w-11 h-11 rounded-xl flex items-center justify-center text-white hover:bg-white/10"
      aria-label="Sign out"
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
    </button>
  );
}

export function OpenPassButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary w-full">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" aria-hidden="true" />}
      Open full-screen pass
    </button>
  );
}

/** Renders a QR token large and high-contrast for the scanner. */
export function QrImage({ token, label }: { token: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toDataURL(token, { width: 560, margin: 4, errorCorrectionLevel: "M", color: { dark: "#0b2e2f", light: "#ffffff" } }).then((url) => alive && setSrc(url)),
    );
    return () => {
      alive = false;
    };
  }, [token]);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-2xl border-2 border-brand-600 p-3 bg-white">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={src} alt={`${label} QR code`} width={240} height={240} className="w-[min(240px,62vw)] h-auto [image-rendering:pixelated]" />
        ) : (
          <div className="w-[min(240px,62vw)] aspect-square flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-300" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#23403f]">
        <Sun className="w-3.5 h-3.5" aria-hidden="true" /> Turn up your screen brightness
      </p>
    </div>
  );
}

/** Milliseconds until `until`; null until mounted so server and client render the same HTML. */
function useCountdown(until: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Date.parse(until) - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);
  return left;
}

/** Time-out pass: generated on demand (short-lived), shown with a live countdown. */
export function TimeOutPass({ registrationId, initial }: { registrationId: string; initial: { token: string; expiresAt: string } | null }) {
  const router = useRouter();
  const [pass, setPass] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const left = useCountdown(pass?.expiresAt ?? null);
  const expired = pass !== null && left !== null && left <= 0;

  function generate() {
    setError(null);
    start(async () => {
      const r = await requestTimeOutPass(registrationId);
      if (r.ok) {
        setPass({ token: r.token, expiresAt: r.expiresAt });
        router.refresh();
      } else setError(r.error);
    });
  }

  if (pass && !expired) {
    const ms = left ?? 0;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return (
      <div className="flex flex-col items-center gap-2">
        <QrImage token={pass.token} label="Time out" />
        <p className="text-sm font-semibold text-ink flex items-center gap-1.5" aria-live="polite">
          <Clock className="w-4 h-4 text-brand-600" aria-hidden="true" /> {left === null ? "Valid for a few minutes" : `Valid for ${m}:${String(s).padStart(2, "0")}`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={generate} disabled={pending} className="btn-primary btn-lg w-full">
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-5 h-5" aria-hidden="true" />}
        {expired ? "Generate a new time-out QR" : "Get my time-out QR"}
      </button>
      {expired && <p className="text-xs text-center text-[#4b6362]">Your previous time-out QR expired.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-danger-600 text-center">{error}</p>}
    </div>
  );
}

function ClaimSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" aria-hidden="true" />} Add registration
    </button>
  );
}

/** Add an older registration (made before the account existed) with its reference code. */
export function ClaimForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [state, action] = useActionState<ClaimState, FormData>(claimAction, null);
  return (
    <details className="card overflow-hidden group" open={defaultOpen}>
      <summary className="cursor-pointer min-h-14 px-4 font-semibold text-ink flex items-center gap-2 list-none">
        <Plus className="w-4 h-4 text-brand-600" aria-hidden="true" /> Add a registration with a reference code
      </summary>
      <form action={action} className="px-4 pb-4 flex flex-col gap-3">
        <p className="text-sm text-[#4b6362]">Registered before you had an account? Enter your student ID and the reference code from that registration.</p>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="claim-id" className="label">Student ID</label>
            <input id="claim-id" name="studentId" className="input font-mono" inputMode="numeric" placeholder="2020001234" autoComplete="off" required />
          </div>
          <div className="min-w-0">
            <label htmlFor="claim-ref" className="label">Reference code</label>
            <input id="claim-ref" name="referenceCode" className="input font-mono uppercase" placeholder="SA-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" required maxLength={12} />
          </div>
        </div>
        {state && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm font-semibold text-success-700" : "text-sm font-semibold text-danger-600"}>{state.message}</p>}
        <ClaimSubmit />
      </form>
    </details>
  );
}

export function GetQrButton({ label = "Get QR pass" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto sm:min-w-40">
      {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><QrCode className="w-4 h-4" aria-hidden="true" /> {label}</>}
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />} Save details
    </button>
  );
}

type ProfileValues = { fullName: string; studentId: string; section: string; yearLevel: string; department: string };

/** Saved student details used for one-tap registration. */
export function ProfileForm({ initial, open }: { initial: ProfileValues | null; open: boolean }) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfileAction, null);
  const f = state?.fields ?? {};
  const err = (k: keyof ProfileValues) =>
    f[k]?.[0] ? <p id={`p-${k}-msg`} className="field-error" role="alert">{f[k][0]}</p> : null;
  const v = initial ?? { fullName: "", studentId: "", section: "", yearLevel: "", department: "College of Nursing" };
  return (
    <details id="my-details" className="card overflow-hidden group scroll-mt-4" open={open}>
      <summary className="cursor-pointer min-h-14 px-4 font-semibold text-ink flex items-center gap-2 list-none">
        <span className="flex-1">{initial ? "My details" : "Add your student details"}</span>
        {!initial && <span className="badge badge-yellow">Required</span>}
        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <form action={action} className="px-4 pb-4 flex flex-col gap-3" noValidate>
        <p className="text-sm text-[#4b6362]">Used when you get a QR pass for an event. Your name and student ID are stored encrypted.</p>
        <div>
          <label htmlFor="p-fullName" className="label">Full name</label>
          <input id="p-fullName" name="fullName" defaultValue={v.fullName} className="input" autoComplete="name" placeholder="e.g. Maria Clara Santos" aria-invalid={f.fullName ? true : undefined} aria-describedby="p-fullName-msg" />
          {err("fullName")}
        </div>
        <div>
          <label htmlFor="p-studentId" className="label">Student ID</label>
          <input id="p-studentId" name="studentId" defaultValue={v.studentId} className="input font-mono" inputMode="numeric" maxLength={12} placeholder={`e.g. ${STUDENT_ID_EXAMPLE}`} aria-invalid={f.studentId ? true : undefined} aria-describedby="p-studentId-msg" />
          {err("studentId") ?? <p id="p-studentId-msg" className="mt-1 text-xs text-[#4b6362]">10 digits, no dash — e.g. {STUDENT_ID_EXAMPLE}</p>}
        </div>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="p-section" className="label">Section</label>
            <input id="p-section" name="section" defaultValue={v.section} className="input" autoCapitalize="characters" placeholder="e.g. BSN 2-B" aria-invalid={f.section ? true : undefined} />
            {err("section")}
          </div>
          <div className="min-w-0">
            <label htmlFor="p-yearLevel" className="label">Year level</label>
            <select id="p-yearLevel" name="yearLevel" defaultValue={v.yearLevel} className="input" aria-invalid={f.yearLevel ? true : undefined}>
              <option value="" disabled>Select…</option>
              {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {err("yearLevel")}
          </div>
        </div>
        <div>
          <label htmlFor="p-department" className="label">College / department</label>
          <input id="p-department" name="department" defaultValue={v.department} className="input" aria-invalid={f.department ? true : undefined} />
          {err("department")}
        </div>
        {state?.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm font-semibold text-success-700" : "text-sm font-semibold text-danger-600"}>{state.message}</p>}
        <SaveButton />
      </form>
    </details>
  );
}
