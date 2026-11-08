import Image from "next/image";
import { clsx } from "clsx";
import { MapPin, ShieldCheck } from "lucide-react";
import uaSeal from "../../public/images/ua-seal.png";

/**
 * Site footer for public and student pages. Pure server component (no client JS).
 * `className` lets pages with a fixed bottom bar add extra bottom padding so nothing is hidden.
 */
export default function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={clsx("bg-ink text-white", className ?? "pb-[env(safe-area-inset-bottom)]")}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Row 1: brand | office (right). Stacked and left-aligned on phones. */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="flex items-start gap-3">
            <Image src={uaSeal} alt="University of the Assumption seal" sizes="44px" className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">University of the Assumption</p>
              <p className="text-sm text-white/75">College of Nursing and Pharmacy</p>
            </div>
          </div>

          <section aria-labelledby="footer-office" className="min-w-0">
            <h2 id="footer-office" className="text-xs font-bold uppercase tracking-[0.12em] text-[#e3c98c]">
              Office
            </h2>
            <address className="mt-2 text-sm not-italic leading-relaxed">
              <span className="block text-white/90">College of Nursing &amp; Pharmacy Office</span>
              <span className="flex items-center gap-1.5 text-white/70">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#e3c98c]" aria-hidden="true" />
                2nd Floor, Puno Building
              </span>
            </address>
          </section>
        </div>

        {/* Row 2: divider, then copyright | privacy */}
        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 lg:flex-row lg:items-center lg:justify-between">
          <p>© {year} University of the Assumption. AttendSure attendance system.</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Data encrypted per RA 10173 (Data Privacy Act of 2012)
          </p>
        </div>
      </div>
    </footer>
  );
}
