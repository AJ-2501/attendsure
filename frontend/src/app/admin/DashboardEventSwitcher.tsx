"use client";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { EffectiveStatus } from "@/lib/types";

export type SwitcherEvent = { id: string; name: string; status: EffectiveStatus; date: string };

/** Live first, then what's coming, then history: the order admins usually look for. */
const GROUPS: { label: string; statuses: EffectiveStatus[] }[] = [
  { label: "Happening now", statuses: ["ongoing"] },
  { label: "Registration open", statuses: ["open"] },
  { label: "Upcoming", statuses: ["upcoming"] },
  { label: "Past", statuses: ["completed"] },
  { label: "Drafts & cancelled", statuses: ["draft", "cancelled"] },
];

/**
 * Event selector for the dashboard's stats card. Selection lives in the URL (?event=)
 * so it survives refresh, works with Back, and can be shared; the card dims while
 * the next event's numbers load.
 */
export default function DashboardEventSwitcher({
  events,
  selectedId,
  children,
}: {
  events: SwitcherEvent[];
  selectedId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function select(id: string) {
    if (!id || id === selectedId) return;
    startTransition(() => router.push(`${pathname}?event=${encodeURIComponent(id)}`, { scroll: false }));
  }

  return (
    <div className="card p-4 sm:p-5 shadow-[0_8px_24px_rgb(11_46_47/0.08)]" aria-busy={pending}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pb-4 mb-4 border-b border-[#eef4f3]">
        <label htmlFor="dashboard-event" className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-[#4b6362] shrink-0">
          <CalendarDays className="w-4 h-4" aria-hidden="true" /> Showing event
        </label>
        <div className="relative flex-1 min-w-0 sm:max-w-md">
          <select
            id="dashboard-event"
            value={selectedId}
            onChange={(e) => select(e.target.value)}
            className="input appearance-none pr-10 font-semibold text-ink truncate"
          >
            {GROUPS.map(({ label, statuses }) => {
              const items = events.filter((e) => statuses.includes(e.status));
              return items.length ? (
                <optgroup key={label} label={label}>
                  {items.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.date}</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
          {pending
            ? <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-600 animate-spin pointer-events-none" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />}
        </div>
        <span className="sr-only" role="status">{pending ? "Loading event statistics…" : ""}</span>
      </div>
      <div className={clsx("transition-opacity duration-200", pending && "opacity-50 pointer-events-none")}>{children}</div>
    </div>
  );
}
