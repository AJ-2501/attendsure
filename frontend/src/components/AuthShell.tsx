import Link from "next/link";
import { ChevronLeft, GraduationCap, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";

/** Sign-in page content: role-badged heading, the form, and a way back. The frame lives in `app/(auth)/layout.tsx`. */
export default function AuthShell({
  role,
  title,
  subtitle,
  children,
}: {
  role: "student" | "admin";
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const Icon = role === "admin" ? ShieldCheck : GraduationCap;
  return (
    <>
      <div className="flex items-start gap-3.5">
        <span
          className={clsx(
            "w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ring-1",
            role === "admin" ? "bg-ink text-mint ring-ink/10" : "bg-brand-50 text-brand-600 ring-brand-100",
          )}
          aria-hidden="true"
        >
          <Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-0.5 text-sm text-[#4b6362]">{subtitle}</p>
        </div>
      </div>
      {children}
      <Link href="/" className="self-center min-h-11 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 active:scale-[0.98] transition-transform">
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to events
      </Link>
    </>
  );
}
