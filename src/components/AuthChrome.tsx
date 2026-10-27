"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { BadgeCheck, LogIn, QrCode, ScanLine, UserPlus } from "lucide-react";
import { LogoMark } from "@/components/Brand";

const PassScanScene = dynamic(() => import("@/components/PassScanScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" aria-hidden="true" />,
});

type Role = "student" | "admin";
const roleOf = (pathname: string): Role => (pathname.startsWith("/login") ? "admin" : "student");

const TAGLINE: Record<Role, string> = {
  student: "Your attendance, assured.",
  admin: "Run every check-in with confidence.",
};

const STEPS = [
  { icon: QrCode, label: "Show pass" },
  { icon: ScanLine, label: "Scan" },
  { icon: BadgeCheck, label: "Checked in" },
];

/** Brand panel: wordmark, role tagline and the animated pass-scan scene. Persists across role switches. */
export function AuthVisual() {
  const role = roleOf(usePathname());
  return (
    <div className="hero-aurora relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-10 lg:px-12 pt-[calc(2.25rem+env(safe-area-inset-top))] pb-14 lg:py-14 lg:w-1/2 lg:flex-1 lg:min-h-dvh">
      <Link href="/" className="inline-flex items-center gap-3 rounded-2xl focus-visible:outline-mint" aria-label="AttendSure home">
        <span className="w-11 h-11 lg:w-12 lg:h-12 rounded-[14px] bg-brand-600 flex items-center justify-center shadow-[0_10px_30px_-8px_rgb(45_212_191/0.6)] ring-1 ring-white/10">
          <LogoMark className="w-6 h-6 lg:w-7 lg:h-7 text-white" strokeWidth={2} />
        </span>
        <span className="text-[28px] lg:text-[34px] font-extrabold tracking-tight text-white">
          Attend<span className="text-gradient-mint">Sure</span>
        </span>
      </Link>
      <p key={role} className="animate-fade-up mt-2 text-[15px] lg:text-lg text-[#b5d3d0] text-center">
        {TAGLINE[role]}
      </p>

      <div className="relative w-full max-w-[540px] h-[230px] sm:h-[300px] lg:h-[460px] mt-2 lg:mt-4" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[62%] aspect-square rounded-full bg-[radial-gradient(circle,rgb(94_234_212/0.16),rgb(227_201_140/0.06)_45%,transparent_70%)] blur-2xl" />
        <PassScanScene className="absolute inset-0" />
      </div>

      <ol className="hidden sm:flex items-center gap-2 lg:gap-3 mt-1" aria-label="How check-in works">
        {STEPS.map(({ icon: Icon, label }, i) => (
          <li key={label} className="flex items-center gap-2 lg:gap-3">
            {i > 0 && <span className="w-6 lg:w-10 h-px bg-gradient-to-r from-mint/10 via-mint/50 to-mint/10" aria-hidden="true" />}
            <span className="glass-chip !py-2 !px-3 !rounded-full text-[13px] font-semibold">
              <Icon className="w-4 h-4 text-mint" aria-hidden="true" /> {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Segmented auth switch:
 * - For event / student registration flows: toggles between "Register" and "Student sign in"
 * - For staff login (/login): hidden completely (no other sign in buttons)
 */
export function RoleSwitch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<"left" | "right" | null>(null);

  const isStudent = pathname.startsWith("/student");
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const activeTab: "left" | "right" = pathname.startsWith("/student/signup") ? "left" : "right";
  const shown = pending ?? activeTab;

  // Clear pending state once pathname changes
  if (pending && pending === activeTab) {
    setPending(null);
  }

  // When on Admin sign in, completely remove other sign-in options/buttons
  if (!isStudent) {
    return null;
  }

  const leftItem = {
    href: `/student/signup${qs}`,
    label: "Register",
    icon: UserPlus,
  };

  const rightItem = {
    href: `/student/login${qs}`,
    label: "Student sign in",
    icon: LogIn,
  };

  return (
    <nav aria-label="Authentication mode" className="relative grid grid-cols-2 p-1 rounded-2xl bg-[#e4eeec] ring-1 ring-inset ring-[#d3e2df]">
      <span
        aria-hidden="true"
        className={clsx(
          "absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
          shown === "right"
            ? "translate-x-full bg-white shadow-[0_4px_12px_-4px_rgb(11_46_47/0.25)]"
            : "translate-x-0 bg-white shadow-[0_4px_12px_-4px_rgb(11_46_47/0.25)]",
        )}
      />
      <Link
        href={leftItem.href}
        prefetch={true}
        onClick={() => activeTab !== "left" && setPending("left")}
        aria-current={shown === "left" ? "page" : undefined}
        className={clsx(
          "relative z-10 min-h-11 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 px-2 text-xs sm:text-sm font-bold transition-colors duration-200",
          shown === "left" ? "text-ink" : "text-[#4b6362] hover:text-ink",
        )}
      >
        <leftItem.icon className={clsx("w-4 h-4 shrink-0 transition-transform duration-300", shown === "left" && "scale-110 text-brand-600")} aria-hidden="true" />
        <span className="truncate">{leftItem.label}</span>
      </Link>
      <Link
        href={rightItem.href}
        prefetch={true}
        onClick={() => activeTab !== "right" && setPending("right")}
        aria-current={shown === "right" ? "page" : undefined}
        className={clsx(
          "relative z-10 min-h-11 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 px-2 text-xs sm:text-sm font-bold transition-colors duration-200",
          shown === "right" ? "text-ink" : "text-[#4b6362] hover:text-ink",
        )}
      >
        <rightItem.icon className={clsx("w-4 h-4 shrink-0 transition-transform duration-300", shown === "right" && "scale-110 text-brand-600")} aria-hidden="true" />
        <span className="truncate">{rightItem.label}</span>
      </Link>
    </nav>
  );
}

/** Re-plays the entrance animation cleanly on route change. */
export function AuthStage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="auth-stagger flex flex-col gap-5 animate-fade-up">
      {children}
    </div>
  );
}
