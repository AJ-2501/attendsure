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
    <div className="monitor-grid relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-10 lg:px-12 pt-[calc(3rem+env(safe-area-inset-top))] pb-16 lg:py-16 lg:w-1/2 lg:flex-1 lg:min-h-dvh">
      {FLOATERS.map((f, i) => (
        <Plus
          key={i}
          aria-hidden="true"
          strokeWidth={3}
          className={`float-up absolute ${f.tone}`}
          style={{ left: f.left, top: f.top, width: f.size, height: f.size, animationDelay: f.delay }}
        />
      ))}

      <div className="relative w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] lg:w-24 lg:h-24">
        <div className="pulse-out absolute inset-0 rounded-[22px] border-2 border-coral" />
        <div className="heart-beat w-full h-full rounded-[22px] bg-brand-600 flex items-center justify-center shadow-[0_10px_30px_rgb(15_118_110/0.45)]">
          <LogoMark className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white" strokeWidth={2} />
        </div>
      </div>
      <p className="mt-4 text-[30px] sm:text-[34px] lg:text-5xl font-extrabold tracking-tight text-white text-center">
        Attend<span className="text-mint">Sure</span>
      </p>
      <p className="mt-1 text-[15px] lg:text-lg text-[#a7c9c6] text-center max-w-sm">{tagline}</p>

      <EcgLine className="w-full max-w-md lg:max-w-lg h-auto mt-6 lg:mt-10" />
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
      <main className="animate-sheet-up relative -mt-8 lg:mt-0 flex-1 lg:w-1/2 lg:flex-1 bg-white rounded-t-[28px] lg:rounded-none shadow-[0_-12px_40px_rgb(0_0_0/0.25)] lg:shadow-none px-6 sm:px-10 lg:px-12 xl:px-16 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:py-16 flex flex-col justify-center items-center lg:overflow-y-auto">
        <div className="w-full max-w-md flex flex-col gap-5">
          <RoleSwitch active={role} />
          <div>
            <h1 className="text-[22px] sm:text-2xl font-bold text-ink">{title}</h1>
            <p className="mt-1 text-sm text-[#4b6362]">{subtitle}</p>
          </div>
          {children}
          <Link href="/" className="mt-2 self-center min-h-11 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 active:scale-[0.98] transition-transform">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to events
          </Link>
        </div>
      </main>
    </div>
  );
}
