"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, LogOut, QrCode, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Re-fetch attendance every 30s while the tab is visible, so a scan shows up without reloading. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);
  return null;
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      className="w-11 h-11 rounded-xl flex items-center justify-center text-white hover:bg-white/10"
      aria-label="Refresh attendance"
    >
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
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" aria-hidden="true" />}
      Open my QR pass
    </button>
  );
}
