import { clsx } from "clsx";

/** Heart with a nursing cross — the AttendSure mark. */
export function LogoMark({ className, strokeWidth = 2.2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 7.5 6Z" />
      <path d="M12 10v5M9.5 12.5h5" />
    </svg>
  );
}

/** Square badge + wordmark. `tone="dark"` is for use on the ink background. */
export function Logo({ size = "md", tone = "light", className }: { size?: "sm" | "md" | "lg"; tone?: "light" | "dark"; className?: string }) {
  const box = { sm: "w-8 h-8 rounded-[10px]", md: "w-9 h-9 rounded-[11px]", lg: "w-11 h-11 rounded-[14px]" }[size];
  const icon = { sm: "w-[18px] h-[18px]", md: "w-5 h-5", lg: "w-6 h-6" }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-2xl" }[size];
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <span className={clsx(box, "bg-brand-600 text-white flex items-center justify-center shrink-0")}>
        <LogoMark className={icon} />
      </span>
      <span className={clsx(text, "font-extrabold tracking-tight", tone === "dark" ? "text-white" : "text-ink")}>
        Attend<span className={tone === "dark" ? "text-mint" : "text-brand-600"}>Sure</span>
      </span>
    </span>
  );
}

const ECG_PATH =
  "M0 70H70l8-8 8 8h26l6 10 10-62 10 82 8-30h34l10-12 12 12h56l8-8 8 8h26l6 10 10-62 10 82 8-30h34l10-12 12 12h14";

/** Animated patient-monitor heartbeat line. */
export function EcgLine({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 390 120" className={className}>
      <path d={ECG_PATH} fill="none" stroke="rgb(94 234 212 / 0.16)" strokeWidth="2" />
      <path
        d={ECG_PATH}
        fill="none"
        stroke="var(--color-coral)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1000}
        className={animated ? "ecg-trace" : undefined}
      />
    </svg>
  );
}
