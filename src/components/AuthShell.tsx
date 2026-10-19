import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { clsx } from "clsx";
import { EcgLine, LogoMark } from "@/components/Brand";

const FLOATERS = [
  { left: "9%", top: "72%", size: 18, delay: "0s", tone: "text-mint" },
  { left: "82%", top: "62%", size: 12, delay: "2.2s", tone: "text-mint" },
  { left: "74%", top: "82%", size: 14, delay: "4.1s", tone: "text-coral" },
  { left: "22%", top: "52%", size: 10, delay: "5.4s", tone: "text-mint" },
  { left: "50%", top: "88%", size: 12, delay: "3.3s", tone: "text-mint" },
];

function MonitorPanel({ tagline }: { tagline: string }) {
  return (
    <div className="monitor-grid relative overflow-hidden flex flex-col items-center px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-16 lg:pb-0 lg:justify-center lg:flex-1 lg:min-h-dvh">
      {FLOATERS.map((f, i) => (
        <Plus
          key={i}
          aria-hidden="true"
          strokeWidth={3}
          className={`float-up absolute ${f.tone}`}
          style={{ left: f.left, top: f.top, width: f.size, height: f.size, animationDelay: f.delay }}
        />
      ))}

      <div className="absolute right-5 top-[calc(1.25rem+env(safe-area-inset-top))] flex items-center gap-1.5 font-mono text-[13px] text-mint" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="blink-soft w-3.5 h-3.5 fill-coral">
          <path d="M12 21 4.5 13.6A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 7.5 6Z" />
        </svg>
        <span>72 BPM</span>
      </div>

      <div className="relative w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] lg:w-24 lg:h-24">
        <div className="pulse-out absolute inset-0 rounded-[22px] border-2 border-coral" />
        <div className="heart-beat w-full h-full rounded-[22px] bg-brand-600 flex items-center justify-center shadow-[0_10px_30px_rgb(15_118_110/0.45)]">
          <LogoMark className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white" strokeWidth={2} />
        </div>
      </div>
      <p className="mt-4 text-[30px] sm:text-[34px] lg:text-5xl font-extrabold tracking-tight text-white">
        Attend<span className="text-mint">Sure</span>
      </p>
      <p className="mt-1 text-[15px] lg:text-lg text-[#a7c9c6] text-center">{tagline}</p>

      <EcgLine className="w-full max-w-3xl h-auto mt-4 lg:mt-12" />
    </div>
  );
}

/** Role switch so a student who lands on the admin page (or vice versa) can recover in one tap. */
function RoleSwitch({ active }: { active: "student" | "admin" }) {
  const item = (role: "student" | "admin", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === role ? "page" : undefined}
      className={clsx(
        "min-h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-colors",
        active === role ? "bg-white text-ink shadow-sm" : "text-[#4b6362] hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Sign-in type" className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#e1ecea]">
      {item("student", "/student/login", "Student")}
      {item("admin", "/login", "Admin")}
    </nav>
  );
}

export default function AuthShell({
  role,
  title,
  subtitle,
  tagline = "College of Nursing · Attendance",
  children,
}: {
  role: "student" | "admin";
  title: string;
  subtitle: string;
  tagline?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-ink">
      <MonitorPanel tagline={tagline} />
      <main className="animate-sheet-up relative -mt-8 lg:mt-0 flex-1 lg:flex-none lg:w-[500px] bg-white rounded-t-[28px] lg:rounded-none shadow-[0_-12px_40px_rgb(0_0_0/0.25)] lg:shadow-none px-5 sm:px-8 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:px-14 flex flex-col lg:justify-center lg:overflow-y-auto">
        <div className="w-full max-w-sm mx-auto flex flex-col gap-5 flex-1 lg:flex-none">
          <RoleSwitch active={role} />
          <div>
            <h1 className="text-[22px] font-bold text-ink">{title}</h1>
            <p className="mt-1 text-sm text-[#4b6362]">{subtitle}</p>
          </div>
          {children}
          <Link href="/" className="mt-auto lg:mt-2 self-center min-h-11 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to events
          </Link>
        </div>
      </main>
    </div>
  );
}
