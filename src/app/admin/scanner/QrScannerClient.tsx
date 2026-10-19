"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, CameraOff, CheckCircle, XCircle, Loader2, Wifi, WifiOff, Search, Volume2, VolumeX, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { ACTION_LABEL } from "@/lib/messages";

interface EventOption { id: string; name: string; }
interface ScanResult {
  code: string;
  accepted: boolean;
  message: string;
  registrationId: string | null;
  recordedAt: string | null;
  confirmationRef: string | null;
  identity: { fullName: string; studentId: string } | null;
}

interface Props {
  events: EventOption[];
  defaultEventId?: string;
}

export default function QrScannerClient({ events, defaultEventId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pending, setPending] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [eventId, setEventId] = useState(defaultEventId ?? events[0]?.id ?? "");
  const [action, setAction] = useState<"time_in" | "time_out">("time_in");
  const [manualQuery, setManualQuery] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const scanCooldown = useRef(false);

  // Online / offline tracking
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const playSound = useCallback((accepted: boolean) => {
    if (!soundEnabled || typeof AudioContext === "undefined") return;
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
    } catch {}
  }, [soundEnabled]);

  const submitToken = useCallback(async (token: string) => {
    if (!eventId || !online) return;
    if (scanCooldown.current) return;
    scanCooldown.current = true;
    setTimeout(() => { scanCooldown.current = false; }, 2500);

    setPending(true);
    setLastToken(token);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventId, action, idempotencyKey: crypto.randomUUID() }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
        playSound(json.data.accepted);
      } else {
        setResult({ code: json.error?.code ?? "ERROR", accepted: false, message: json.error?.message ?? "Server error", registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
        playSound(false);
      }
    } catch {
      setResult({ code: "NETWORK_ERROR", accepted: false, message: "Network error — scan not recorded.", registrationId: null, recordedAt: null, confirmationRef: null, identity: null });
      playSound(false);
    } finally {
      setPending(false);
    }
  }, [eventId, action, online, playSound]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanning(true);

      // Dynamically import ZXing for scanning
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      if (videoRef.current) {
        reader.decodeFromVideoElement(videoRef.current, (result, _err, controls) => {
          if (result) {
            const text = result.getText();
            if (text !== lastToken || !scanCooldown.current) {
              submitToken(text);
            }
          }
        });
      }
    } catch (err) {
      setCameraError("Camera access denied or unavailable. Please allow camera access.");
      setScanning(false);
    }
  }, [submitToken, lastToken]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    setResult(null);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualQuery.trim() || !eventId) return;
    setManualLoading(true);
    try {
      const lookupRes = await fetch(`/api/participants/lookup?q=${encodeURIComponent(manualQuery)}&eventId=${eventId}`);
      const lookupJson = await lookupRes.json();
      if (!lookupJson.ok || !lookupJson.data?.registrationId) {
        setResult({ code: "NOT_FOUND", accepted: false, message: "Participant not found in this event.", registrationId: null, recordedAt: null, confirmationRef: null, identity: lookupJson.data?.identity ?? null });
        return;
      }
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, registrationId: lookupJson.data.registrationId, action, reason: manualReason || "Manual lookup", idempotencyKey: crypto.randomUUID() }),
      });
      const json = await res.json();
      if (json.ok) { setResult(json.data); playSound(json.data.accepted); }
      else { setResult({ code: json.error?.code ?? "ERROR", accepted: false, message: json.error?.message ?? "Error", registrationId: null, recordedAt: null, confirmationRef: null, identity: null }); playSound(false); }
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
            {online ? <><Wifi className="w-3.5 h-3.5" /> Online</> : <><WifiOff className="w-3.5 h-3.5" /> Offline — scans will not be recorded</>}
          </div>
        </div>
        <button onClick={() => setSoundEnabled((s) => !s)} className="btn-secondary w-11 h-11 p-0" aria-label={soundEnabled ? "Mute scan sounds" : "Unmute scan sounds"} aria-pressed={soundEnabled}>
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      <div>
        <label className="label" htmlFor="scan-event">Event</label>
        <div className="relative">
          <select id="scan-event" value={eventId} onChange={(e) => setEventId(e.target.value)} className="input appearance-none pr-9">
            {events.length === 0 && <option value="">No active events</option>}
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" />
        </div>
      </div>

      <div role="radiogroup" aria-label="Scan action" className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#e1ecea]">
        {(["time_in", "time_out"] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={action === a}
            onClick={() => setAction(a)}
            className={clsx("min-h-12 rounded-xl text-[15px] font-bold transition-colors", action === a ? "bg-brand-600 text-white shadow" : "text-[#23403f]")}
          >
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>

      {/* Camera */}
      <div className="rounded-[22px] overflow-hidden bg-[#061a1b] shadow-[0_8px_24px_rgb(11_46_47/0.15)]">
        <div className="relative aspect-square sm:aspect-[4/3] w-full">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Camera className="w-12 h-12 opacity-40" />
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
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="p-3">
          {!scanning ? (
            <button onClick={startCamera} disabled={!eventId} className="btn-primary btn-lg w-full">
              <Camera className="w-5 h-5" /> Start camera
            </button>
          ) : (
            <button onClick={stopCamera} className="btn btn-lg w-full bg-white/10 text-white hover:bg-white/20">
              <CameraOff className="w-5 h-5" /> Stop camera
            </button>
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
                {result.accepted ? <CheckCircle className="w-6 h-6 text-white" /> : <XCircle className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold">{result.accepted ? "Attendance recorded" : "Scan rejected"}</p>
                <p className="text-sm mt-0.5">{result.message}</p>
                {result.identity && <p className="text-sm font-semibold text-ink mt-1">{result.identity.fullName}</p>}
                {result.recordedAt && (
                  <p className="font-mono text-xs mt-1 opacity-80">
                    {new Date(result.recordedAt).toLocaleTimeString()} · {result.confirmationRef}
                  </p>
                )}
              </div>
              <button onClick={() => setResult(null)} className="btn-ghost w-11 h-11 p-0 -mr-1 -mt-1" aria-label="Dismiss result">
                <XCircle className="w-5 h-5 opacity-60" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual lookup */}
      <details className="card overflow-hidden group">
        <summary className="cursor-pointer min-h-14 px-5 font-semibold text-ink flex items-center gap-2 list-none">
          <Search className="w-4 h-4" /> Manual entry
          <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
        </summary>
        <form onSubmit={submitManual} className="px-5 pb-5 space-y-3">
          <div>
            <label className="label" htmlFor="manual-query">Student ID or reference code</label>
            <input id="manual-query" value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} className="input font-mono" placeholder="2021001955 or SA-XXXX-XXXX" autoCapitalize="characters" />
          </div>
          <div>
            <label className="label" htmlFor="manual-reason">Reason *</label>
            <input id="manual-reason" value={manualReason} onChange={(e) => setManualReason(e.target.value)} className="input" placeholder="QR pass damaged / phone battery dead" required />
          </div>
          <button type="submit" disabled={manualLoading || !manualQuery.trim()} className="btn-primary btn-lg w-full">
            {manualLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</> : `Record ${ACTION_LABEL[action].toLowerCase()}`}
          </button>
        </form>
      </details>
    </div>
  );
}
