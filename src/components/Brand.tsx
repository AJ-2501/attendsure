import Image from "next/image";
import { clsx } from "clsx";
import seal from "../../public/images/conp-seal.png";

/**
 * UA College of Nursing and Pharmacy seal. Decorative next to the wordmark (the
 * surrounding link carries the accessible name); pass `alt` when shown alone.
 */
export function Seal({ className, alt = "", priority }: { className?: string; alt?: string; priority?: boolean }) {
  return (
    <Image
      src={seal}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      sizes="64px"
      quality={90}
      priority={priority}
      className={clsx("shrink-0 rounded-full drop-shadow-[0_2px_6px_rgb(11_46_47/0.25)]", className)}
    />
  );
}

/** Seal + wordmark. `tone="dark"` is for use on the ink background. */
export function Logo({ size = "md", tone = "light", className }: { size?: "sm" | "md" | "lg"; tone?: "light" | "dark"; className?: string }) {
  const mark = { sm: "w-10 h-10", md: "w-11 h-11", lg: "w-14 h-14" }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-2xl" }[size];
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <Seal className={mark} priority />
      <span className={clsx(text, "font-extrabold tracking-tight", tone === "dark" ? "text-white" : "text-ink")}>
        Attend<span className={tone === "dark" ? "text-gradient-seal" : "text-gradient-seal-ink"}>Sure</span>
      </span>
    </span>
  );
}
