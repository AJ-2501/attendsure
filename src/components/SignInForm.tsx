"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const STAFF_ROLES = ["super_admin", "event_admin", "scanner_staff"];

function friendlyError(message: string) {
  if (/invalid login|invalid credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Your email isn't confirmed yet. Check your inbox.";
  if (/rate|too many/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection.";
  return "Sign-in failed. Please try again.";
}

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
function safeNext(next: string | null | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

type Errors = { email?: string; password?: string; form?: React.ReactNode };

export default function SignInForm({
  expect,
  redirectTo,
  next,
  emailPlaceholder,
  initialError = null,
}: {
  /** Which kind of account this page is for. A mismatch is rejected with guidance instead of a silent redirect. */
  expect: "student" | "staff";
  redirectTo: string;
  next?: string | null;
  emailPlaceholder: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>(initialError ? { form: initialError } : {});
  const [loading, setLoading] = useState(false);

  function validate(): Errors {
    const e: Errors = {};
    if (!email.trim()) e.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email, like name@nursing.edu.ph.";
    if (!password) e.password = "Enter your password.";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (v.email || v.password) {
      document.getElementById(v.email ? "email" : "password")?.focus();
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        setErrors({ form: friendlyError(error?.message ?? "") });
        return;
      }
      // Check the account type before navigating (profiles RLS allows reading your own row).
      const { data: profile } = await supabase.from("profiles").select("role").eq("auth_user_id", data.user.id).maybeSingle<{ role: string }>();
      const isStaff = profile ? STAFF_ROLES.includes(profile.role) : null;
      if (isStaff !== null && isStaff !== (expect === "staff")) {
        await supabase.auth.signOut();
        setErrors({
          form:
            expect === "student" ? (
              <>This is an admin account. Use <Link href="/login" className="underline font-bold">Admin sign in</Link> instead.</>
            ) : (
              <>This is a student account. Use <Link href="/student/login" className="underline font-bold">Student sign in</Link> to see your attendance.</>
            ),
        });
        return;
      }
      router.replace(safeNext(next, redirectTo));
      router.refresh();
    } catch (err) {
      setErrors({ form: friendlyError(err instanceof Error ? err.message : "") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
          }}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-err" : undefined}
          className="input bg-[#f3f7f6]"
          placeholder={emailPlaceholder}
        />
        {errors.email && <p id="email-err" className="field-error" role="alert">{errors.email}</p>}
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
            }}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-err" : undefined}
            className="input bg-[#f3f7f6] pr-14"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#4b6362] hover:bg-slate-100"
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.password && <p id="password-err" className="field-error" role="alert">{errors.password}</p>}
      </div>

      {errors.form && (
        <div role="alert" className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errors.form}</span>
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-1 shadow-[0_8px_20px_rgb(15_118_110/0.3)]">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="w-[18px] h-[18px]" /></>}
      </button>
    </form>
  );
}
