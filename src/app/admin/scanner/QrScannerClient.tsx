"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle, XCircle, Loader2, Wifi, WifiOff, Search, Volume2, VolumeX, ChevronDown, SwitchCamera } from "lucide-react";
import { clsx } from "clsx";
import { ACTION_LABEL } from "@/lib/messages";

interface EventOption { id: string; name: string; }
interface ScanResult {
  code: string;
  accepted: boolean;
  message: string;
  action?: "time_in" | "time_out";
  registrationId: string | null;
  recordedAt: string | null;
  confirmationRef: string | null;
  identity: { fullName: string; studentId: string } | null;
}

interface Props {
  events: EventOption[];
  defaultEventId?: string;
}

type Mode = "auto" | "time_in" | "time_out";
const MODES: { id: Mode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "time_in", label: "Time in" },
  { id: "time_out", label: "Time out" },
];

/** Minimal shape of @zxing/browser's IScannerControls (also used for the native detector loop). */
type ScannerControls = { stop: () => void };

/** The Shape Detection API's BarcodeDetector (not yet in TypeScript's DOM lib). */
type NativeDetectorCtor = {
  new (opts: { formats: string[] }): { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
  getSupportedFormats: () => Promise<string[]>;
};

function cameraErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "The camera needs a secure (https://) connection. Open the deployed site, or use localhost on this device.";
  }
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was denied. Allow camera access in your browser settings, then tap Start camera.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError" || name === "AbortError") return "The camera is being used by another app. Close it and try again.";
  return "Couldn't start the camera. Check permissions and try again.";
}

export default function QrScannerClient({ events, defaultEventId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [eventId, setEventId] = useState(defaultEventId ?? events[0]?.id ?? "");
  const [action, setAction] = useState<Mode>("auto");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [manualQuery, setManualQuery] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualErrors, setManualErrors] = useState<{ query?: string; reason?: string }>({});
  const [manualLoading, setManualLoading] = useState(false);

  // The decoder callback lives as long as the camera; read current settings through refs
  // so switching event/mode mid-session takes effect immediately.
  const settingsRef = useRef({ eventId, action, online, soundEnabled });
  useEffect(() => {
    settingsRef.current = { eventId, action, online, soundEnabled };
  }, [eventId, action, online, soundEnabled]);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);

  // Online / offline tracking
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const playSound = useCallback((accepted: boolean) => {
    if (!settingsRef.current.soundEnabled || typeof AudioContext === "undefined") return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = accepted ? 880 : 220;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (accepted ? 0.4 : 0.6));
      osc.start(); osc.stop(ctx.currentTime + 0.6);
      navigator.vibrate?.(accepted ? 80 : [60, 60, 60]);
    } catch {}
  }, []);

  const submitToken = useCallback(async (raw: string) => {
    const { eventId: ev, action: mode, online: isOnline } = settingsRef.current;
    const text = raw.trim();
    if (!ev || busyRef.current) return;
    // Ignore the same code held in frame (one submission per 4s per code).
    const last = lastScanRef.current;
    if (last && last.text === text && Date.now() - last.at < 4000) return;
    lastScanRef.current = { text, at: Date.now() };
    if (!isOnline) {
      setResult({ code: "OFFLINE", accepted: false, message: "You're offline. This scan was not recorded.", registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
      return;
    }

    busyRef.current = true;
    setPending(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: text, eventId: ev, action: mode, idempotencyKey: crypto.randomUUID() }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
        playSound(json.data.accepted);
      } else {
        const message = res.status === 401 ? "Your session expired. Sign in again to keep scanning." : json.error?.message ?? "Server error";
        setResult({ code: json.error?.code ?? "ERROR", accepted: false, message, registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
        playSound(false);
      }
    } catch {
      setResult({ code: "NETWORK_ERROR", accepted: false, message: "Network error — scan not recorded. Try again.", registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
      playSound(false);
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }, [playSound]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async (cam: "environment" | "user" = facing) => {
    setCameraError(null);
    setResult(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(cameraErrorMessage(null));
      return;
    }
    setStarting(true);
    const constraints: MediaStreamConstraints = {
      video: { facingMode: { ideal: cam }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };
    try {
      const video = videoRef.current;
      if (!video) return;

      // Prefer the platform's native QR detector (fast and robust on Android/Chrome); fall back to ZXing.
      const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
      const nativeQr = Native ? (await Native.getSupportedFormats().catch(() => [] as string[])).includes("qr_code") : false;
      if (Native && nativeQr) {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        await video.play().catch(() => {});
        const detector = new Native({ formats: ["qr_code"] });
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) void submitToken(codes[0].rawValue);
            } catch {}
          }
          timer = setTimeout(tick, 120);
        };
        void tick();
        controlsRef.current = {
          stop: () => {
            stopped = true;
            clearTimeout(timer);
          },
        };
      } else {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120 });
        // decodeFromConstraints opens the camera, attaches it to the <video> and keeps decoding.
        controlsRef.current = await reader.decodeFromConstraints(constraints, video, (res) => {
          if (res) void submitToken(res.getText());
        });
      }
      setScanning(true);
    } catch (err) {
      setCameraError(cameraErrorMessage(err));
      stopCamera();
    } finally {
      setStarting(false);
    }
  }, [facing, stopCamera, submitToken]);

  function flipCamera() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (scanning) void startCamera(next);
  }

  // Stop the camera when leaving the page or hiding the tab (saves battery, frees the camera).
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && stopCamera();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-dismiss successful results so the next student can step up.
  useEffect(() => {
    if (!result?.accepted) return;
    const t = setTimeout(() => setResult((r) => (r === result ? null : r)), 6000);
    return () => clearTimeout(t);
  }, [result]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const errs: { query?: string; reason?: string } = {};
    if (manualQuery.trim().length < 3) errs.query = "Enter a student ID or reference code (at least 3 characters).";
    if (manualReason.trim().length < 5) errs.reason = "Provide a reason of at least 5 characters.";
    setManualErrors(errs);
    if (errs.query || errs.reason) {
      document.getElementById(errs.query ? "manual-query" : "manual-reason")?.focus();
      return;
    }
    if (!eventId) return;
    setManualLoading(true);
    try {
      const lookupRes = await fetch(`/api/participants/lookup?q=${encodeURIComponent(manualQuery.trim())}&eventId=${eventId}`);
      const lookupJson = await lookupRes.json();
      if (!lookupJson.ok || !lookupJson.data?.registrationId) {
        setResult({ code: "NOT_FOUND", accepted: false, message: "No registration found for that student ID or reference code in this event.", registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
        playSound(false);
        return;
      }
      const att = lookupJson.data.attendance as { timeInAt: string | null; timeOutAt: string | null } | undefined;
      const manualAction = action === "auto" ? (att?.timeInAt ? "time_out" : "time_in") : action;
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, registrationId: lookupJson.data.registrationId, action: manualAction, reason: manualReason.trim(), idempotencyKey: crypto.randomUUID() }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult({ ...json.data, action: manualAction });
        playSound(json.data.accepted);
        if (json.data.accepted) setManualQuery("");
      } else {
        setResult({ code: json.error?.code ?? "ERROR", accepted: false, message: json.error?.message ?? "Error", registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
        playSound(false);
      }
    } catch {
      setResult({ code: "NETWORK_ERROR", accepted: false, message: "Network error — not recorded. Try again.", registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
    } finally {
      setManualLoading(false);
    }
  }

  const corner = "absolute w-11 h-11 border-mint";
  return (
    <div className="space-y-4 max-w-xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Scanner</h1>
          <div className={clsx("flex items-center gap-1.5 text-xs font-semibold mt-0.5", online ? "text-success-700" : "text-danger-600")} role="status">
            {online ? <><Wifi className="w-3.5 h-3.5" aria-hidden="true" /> Online</> : <><WifiOff className="w-3.5 h-3.5" aria-hidden="true" /> Offline — scans will not be recorded</>}
          </div>
        </div>
        <button onClick={() => setSoundEnabled((s) => !s)} className="btn-secondary w-11 h-11 p-0" aria-label={soundEnabled ? "Mute scan sounds" : "Unmute scan sounds"} aria-pressed={soundEnabled}>
          {soundEnabled ? <Volume2 className="w-5 h-5" aria-hidden="true" /> : <VolumeX className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      <div>
        <label className="label" htmlFor="scan-event">Event</label>
        <div className="relative">
          <select id="scan-event" value={eventId} onChange={(e) => setEventId(e.target.value)} className="input appearance-none pr-9">
            {events.length === 0 && <option value="">No active events</option>}
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      <div>
        <div role="radiogroup" aria-label="Scan action" className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#e1ecea]">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={action === m.id}
              onClick={() => setAction(m.id)}
              className={clsx("min-h-12 rounded-xl text-[15px] font-bold transition-colors", action === m.id ? "bg-brand-600 text-white shadow" : "text-[#23403f]")}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-[#4b6362]">
          {action === "auto" ? "Auto records time in or time out based on the pass the student shows." : `Only ${ACTION_LABEL[action]} passes will be accepted.`}
        </p>
      </div>

      {/* Camera */}
      <div className="rounded-[22px] overflow-hidden bg-[#061a1b] shadow-[0_8px_24px_rgb(11_46_47/0.15)]">
        <div className="relative aspect-square sm:aspect-[4/3] w-full">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Camera className="w-12 h-12 opacity-40" aria-hidden="true" />
              <p className="text-sm text-[#cfe3e0]">Camera off</p>
            </div>
          )}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[62%] aspect-square max-w-64">
                <div className={clsx(corner, "left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl")} />
                <div className={clsx(corner, "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl")} />
                <div className={clsx(corner, "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl")} />
                <div className={clsx(corner, "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl")} />
                <div className="scan-sweep absolute inset-x-4 h-0.5 bg-coral shadow-[0_0_12px_var(--color-coral)]" />
              </div>
              <p className="absolute bottom-3 inset-x-0 text-center text-sm text-[#cfe3e0]">Hold the QR pass inside the frame</p>
            </div>
          )}
          {pending && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
              <Loader2 className="w-10 h-10 text-white animate-spin" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="p-3">
          {!scanning ? (
            <button onClick={() => startCamera()} disabled={!eventId || starting} className="btn-primary btn-lg w-full">
              {starting ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Camera className="w-5 h-5" aria-hidden="true" />} {starting ? "Starting camera…" : "Start camera"}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={stopCamera} className="btn btn-lg flex-1 bg-white/10 text-white hover:bg-white/20">
                <CameraOff className="w-5 h-5" aria-hidden="true" /> Stop camera
              </button>
              <button onClick={flipCamera} className="btn btn-lg w-14 px-0 bg-white/10 text-white hover:bg-white/20" aria-label="Switch camera">
                <SwitchCamera className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        {cameraError && <p className="px-4 pb-4 text-sm text-[#ffb4a6]" role="alert">{cameraError}</p>}
      </div>

      {/* Scan result */}
      <div aria-live="polite">
        {result && (
          <div className={clsx("rounded-2xl p-4 border animate-fade-up", result.accepted ? "scan-accepted" : "scan-rejected")}>
            <div className="flex items-start gap-3">
              <div className={clsx("w-11 h-11 rounded-full flex items-center justify-center shrink-0", result.accepted ? "bg-success-700" : "bg-danger-600")}>
                {result.accepted ? <CheckCircle className="w-6 h-6 text-white" aria-hidden="true" /> : <XCircle className="w-6 h-6 text-white" aria-hidden="true" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold">
                  {result.accepted ? `${result.action ? ACTION_LABEL[result.action] : "Attendance"} recorded` : "Not recorded"}
                </p>
                <p className="text-sm mt-0.5">{result.message}</p>
                {result.identity && <p className="text-sm font-semibold text-ink mt-1">{result.identity.fullName}</p>}
                {result.recordedAt && (
                  <p className="font-mono text-xs mt-1 opacity-80">
                    {new Date(result.recordedAt).toLocaleTimeString()} · {result.confirmationRef}
                  </p>
                )}
              </div>
              <button onClick={() => setResult(null)} className="btn-ghost w-11 h-11 p-0 -mr-1 -mt-1" aria-label="Dismiss result">
                <XCircle className="w-5 h-5 opacity-60" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual lookup */}
      <details className="card overflow-hidden group">
        <summary className="cursor-pointer min-h-14 px-5 font-semibold text-ink flex items-center gap-2 list-none">
          <Search className="w-4 h-4" aria-hidden="true" /> Manual entry
          <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <form onSubmit={submitManual} className="px-5 pb-5 space-y-3" noValidate>
          <div>
            <label className="label" htmlFor="manual-query">Student ID or reference code *</label>
            <input
              id="manual-query"
              value={manualQuery}
              onChange={(e) => {
                setManualQuery(e.target.value);
                if (manualErrors.query) setManualErrors((x) => ({ ...x, query: undefined }));
              }}
              maxLength={40}
              aria-invalid={manualErrors.query ? true : undefined}
              aria-describedby={manualErrors.query ? "manual-query-err" : undefined}
              className="input font-mono"
              placeholder="2020001234 or SA-XXXX-XXXX"
              autoCapitalize="characters"
            />
            {manualErrors.query && (
              <p id="manual-query-err" className="field-error flex items-center gap-1.5" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {manualErrors.query}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="manual-reason">Reason *</label>
            <input
              id="manual-reason"
              value={manualReason}
              onChange={(e) => {
                setManualReason(e.target.value);
                if (manualErrors.reason) setManualErrors((x) => ({ ...x, reason: undefined }));
              }}
              maxLength={500}
              aria-invalid={manualErrors.reason ? true : undefined}
              aria-describedby={manualErrors.reason ? "manual-reason-err" : undefined}
              className="input"
              placeholder="QR pass damaged / phone battery dead"
            />
            {manualErrors.reason && (
              <p id="manual-reason-err" className="field-error flex items-center gap-1.5" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {manualErrors.reason}
              </p>
            )}
          </div>
          <button type="submit" disabled={manualLoading || !eventId} className="btn-primary btn-lg w-full">
            {manualLoading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Looking up…</> : action === "auto" ? "Record attendance" : `Record ${ACTION_LABEL[action].toLowerCase()}`}
          </button>
        </form>
      </details>
    </div>
  );
}
