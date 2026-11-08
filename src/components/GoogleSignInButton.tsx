"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { STUDENT_EMAIL_DOMAIN } from "@/lib/schemas";

/**
 * Start Google sign-in for a student. `hd` pre-filters Google's account picker to the school domain
 * (the callback still enforces it), and `select_account` lets students who are also signed in to a
 * personal Gmail pick the right account instead of being signed in silently with the wrong one.
 */
export async function startGoogleSignIn({ from, next }: { from: "login" | "signup"; next?: string | null }) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("from", from);
  if (next) callback.searchParams.set("next", next);
  const { error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      queryParams: { hd: STUDENT_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

/** Visual for the Google button: white, bordered, official "G" mark (per Google's sign-in branding guidelines). */
export function GoogleButtonFace({ busy, label, busyLabel = "Opening Google…" }: { busy: boolean; label: string; busyLabel?: string }) {
  return busy ? (
    <>
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> {busyLabel}
    </>
  ) : (
    <>
      <GoogleLogo className="w-5 h-5 shrink-0" /> {label}
    </>
  );
}

export const googleButtonClass =
  "btn btn-lg w-full gap-3 bg-white text-[#1f1f1f] border border-[#c7d6d3] shadow-[0_1px_2px_rgb(11_46_47/0.08)] hover:bg-[#f7faf9] hover:border-[#9fb8b4] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-70 disabled:cursor-wait";

/** Reset a "busy" state when the browser restores this page from the back/forward cache (student pressed Back on Google). */
export function useResetOnPageShow(reset: () => void) {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [reset]);
}

/** Student sign-in: one button, no password. */
export default function GoogleSignInButton({ next, className }: { next?: string | null; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useResetOnPageShow(useCallback(() => setBusy(false), []));

  async function onClick() {
    setError(null);
    setBusy(true);
    try {
      await startGoogleSignIn({ from: "login", next });
    } catch {
      setBusy(false);
      setError("Can't reach Google right now. Check your connection and try again.");
    }
  }

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <button type="button" onClick={onClick} disabled={busy} aria-busy={busy} className={googleButtonClass}>
        <GoogleButtonFace busy={busy} label="Continue with Google" />
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger-600 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
