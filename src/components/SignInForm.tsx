"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { signInSchema, type SignInInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { INVALID_CREDENTIALS_MESSAGE, staffEmailFromUsername } from "@/lib/auth/staff-username";

const STAFF_ROLES = ["super_admin", "event_admin", "scanner_staff"];

function friendlyError(message: string) {
  if (/invalid login|invalid credentials|email not confirmed|user not found/i.test(message)) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  if (/rate|too many/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection.";
  return INVALID_CREDENTIALS_MESSAGE;
}

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
function safeNext(next: string | null | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export default function SignInForm({
  expect,
  redirectTo,
  next,
  initialError = null,
}: {
  /** Which kind of account this page is for. Role mismatches return a generic credential error to prevent account enumeration. */
  expect: "student" | "staff";
  redirectTo: string;
  next?: string | null;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(initialError);
  // No prefetch of the destination here: fetched while signed out it would hold the sign-in redirect,
  // and navigating onto it after signing in would need a second (refresh) render to correct.

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: "onTouched",
    defaultValues: { username: "", password: "" },
  });

  function showFormError(msg: string) {
    setFormError(msg);
    requestAnimationFrame(() => document.getElementById("sign-in-error")?.focus());
  }

  async function onSubmit(values: SignInInput) {
    setFormError(null);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: staffEmailFromUsername(values.username),
        password: values.password,
      });
      if (error || !data.user) {
        showFormError(friendlyError(error?.message ?? ""));
        return;
      }
      // Verify the account role matches this portal before navigating.
      // Return a uniform "Incorrect username or password." on mismatch so credentials cannot be used to enumerate roles.
      // The role is mirrored into app_metadata (not user-writable), so it arrives with the sign-in response;
      // accounts not yet backfilled fall back to reading `profiles`. The server re-checks the role on every request.
      let role = typeof data.user.app_metadata?.role === "string" ? data.user.app_metadata.role : null;
      if (!role) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("auth_user_id", data.user.id)
          .maybeSingle<{ role: string }>();
        role = profile?.role ?? null;
      }
      const isStaff = role ? STAFF_ROLES.includes(role) : null;
      if (isStaff === null || isStaff !== (expect === "staff")) {
        await supabase.auth.signOut();
        showFormError(INVALID_CREDENTIALS_MESSAGE);
        return;
      }
      // One navigation: it renders the destination with the new session cookies. Nothing for this
      // route was cached while signed in, so no follow-up router.refresh() is needed.
      router.replace(safeNext(next, redirectTo));
    } catch (err) {
      showFormError(friendlyError(err instanceof Error ? err.message : ""));
    }
  }

  const usernameField = register("username", {
    onChange: () => {
      if (formError) setFormError(null);
    },
  });
  const passwordField = register("password", {
    onChange: () => {
      if (formError) setFormError(null);
    },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (errs) => {
        const first = Object.keys(errs)[0] as keyof SignInInput | undefined;
        if (first) setFocus(first);
      })}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <label className="label" htmlFor="username">Username</label>
        <div className="relative">
        <UserRound className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a9391] pointer-events-none" aria-hidden="true" />
        <input
          id="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={32}
          {...usernameField}
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={errors.username ? "username-err" : undefined}
          className="input bg-[#f3f7f6] pl-11 focus:bg-white"
          placeholder="Enter your username"
        />
        </div>
        {errors.username?.message && (
          <p id="username-err" className="field-error flex items-center gap-1.5" role="alert">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {errors.username.message}
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <LockKeyhole className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a9391] pointer-events-none" aria-hidden="true" />
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            maxLength={72}
            {...passwordField}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-err" : undefined}
            className="input bg-[#f3f7f6] pl-11 pr-14 focus:bg-white"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#4b6362] hover:bg-slate-100"
          >
            {show ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
        {errors.password?.message && (
          <p id="password-err" className="field-error flex items-center gap-1.5" role="alert">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {errors.password.message}
          </p>
        )}
      </div>

      {formError && (
        <div
          id="sign-in-error"
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-500/20 rounded-xl px-3 py-2.5 outline-none"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg btn-sheen w-full mt-1 shadow-[0_10px_24px_-8px_rgb(15_118_110/0.55)]">
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight className="w-[18px] h-[18px]" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
