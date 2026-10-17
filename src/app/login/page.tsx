"use client";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, AlertTriangle, ArrowRight, ChevronLeft, Eye, EyeOff, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EcgLine, LogoMark } from "@/components/Brand";

const FLOATERS = [
  { left: "9%", top: "72%", size: 18, delay: "0s", tone: "text-mint" },
  { left: "82%", top: "62%", size: 12, delay: "2.2s", tone: "text-mint" },
  { left: "74%", top: "82%", size: 14, delay: "4.1s", tone: "text-coral" },
  { left: "22%", top: "52%", size: 10, delay: "5.4s", tone: "text-mint" },
  { left: "50%", top: "88%", size: 12, delay: "3.3s", tone: "text-mint" },
];

function MonitorPanel() {
  return (
    <div className="monitor-grid relative overflow-hidden flex flex-col items-center px-6 pt-14 pb-20 lg:pb-0 lg:justify-center lg:flex-1 lg:min-h-dvh">
      {FLOATERS.map((f, i) => (
        <Plus
          key={i}
          aria-hidden="true"
          strokeWidth={3}
          className={`float-up absolute ${f.tone}`}
          style={{ left: f.left, top: f.top, width: f.size, height: f.size, animationDelay: f.delay }}
        />
      ))}

      <div className="absolute right-5 top-5 flex items-center gap-1.5 font-mono text-[13px] text-mint">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="blink-soft w-3.5 h-3.5 fill-coral">
          <path d="M12 21 4.5 13.6A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 7.5 6Z" />
        </svg>
        <span>72 BPM</span>
      </div>

      <div className="relative w-[76px] h-[76px] lg:w-24 lg:h-24">
        <div className="pulse-out absolute inset-0 rounded-[24px] border-2 border-coral" />
        <div className="heart-beat w-full h-full rounded-[24px] bg-brand-600 flex items-center justify-center shadow-[0_10px_30px_rgb(15_118_110/0.45)]">
          <LogoMark className="w-10 h-10 lg:w-12 lg:h-12 text-white" strokeWidth={2} />
        </div>
      </div>
      <h1 className="mt-5 text-[34px] lg:text-5xl font-extrabold tracking-tight text-white">
        Attend<span className="text-mint">Sure</span>
      </h1>
      <p className="mt-1.5 text-[15px] lg:text-lg text-[#a7c9c6]">College of Nursing · Attendance</p>

      <EcgLine className="w-full max-w-3xl h-auto mt-6 lg:mt-12" />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "not_staff" ? "This account does not have staff access." : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message.includes("Invalid") ? "Invalid email or password." : error.message);
    } else {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <div className="animate-sheet-up relative -mt-9 lg:mt-0 flex-1 lg:flex-none lg:w-[480px] bg-white rounded-t-[28px] lg:rounded-none shadow-[0_-12px_40px_rgb(0_0_0/0.25)] lg:shadow-none px-6 pt-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:px-14 flex flex-col lg:justify-center">
      <div className="w-full max-w-sm mx-auto flex flex-col gap-5 flex-1 lg:flex-none">
        <div>
          <h2 className="text-[22px] font-bold text-ink">Staff sign in</h2>
          <p className="mt-1 text-sm text-[#4b6362]">Clinical instructors, coordinators and scanner staff.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="input bg-[#f3f7f6]"
              placeholder="name@nursing.edu.ph"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input bg-[#f3f7f6] pr-14"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#4b6362] hover:bg-slate-100"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 text-sm text-danger-600 bg-danger-50 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-1 shadow-[0_8px_20px_rgb(15_118_110/0.3)]">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="w-[18px] h-[18px]" /></>}
          </button>
        </form>

        <p className="text-[13px] text-center text-[#4b6362]">Forgot your password? Contact the College of Nursing office.</p>

        <Link href="/" className="mt-auto lg:mt-4 self-center min-h-11 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
          <ChevronLeft className="w-4 h-4" /> Back to events
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-ink">
      <MonitorPanel />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
