"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock, MapPin, Search, X, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { formatInZone, formatTimeRange, STATUS_BADGE, STATUS_LABEL } from "@/lib/time";
import type { EffectiveStatus, PublicEvent } from "@/lib/types";

export interface EventItem {
  event: PublicEvent;
  status: EffectiveStatus;
  /** Registration window phase, computed on the server at request time. */
  regPhase: "before" | "open" | "after";
  registered: number;
}

const FILTERS = [
  { id: "all", label: "All", match: (i: EventItem) => i.status !== "completed" },
  { id: "open", label: "Open for registration", match: (i: EventItem) => i.regPhase === "open" && i.status !== "completed" },
  { id: "ongoing", label: "Happening now", match: (i: EventItem) => i.status === "ongoing" },
  { id: "upcoming", label: "Upcoming", match: (i: EventItem) => i.status === "upcoming" || i.status === "open" },
  { id: "past", label: "Past", match: (i: EventItem) => i.status === "completed" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

function monthKey(e: PublicEvent) {
  return formatInZone(e.starts_at, e.timezone, { year: "numeric", month: "long" });
}

export function SeatsMeter({ capacity, registered, compact }: { capacity: number; registered: number; compact?: boolean }) {
  const left = Math.max(0, capacity - registered);
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 100;
  const low = left > 0 && left <= Math.max(5, Math.ceil(capacity * 0.1));
  return (
    <div className={clsx("flex flex-col gap-1", compact ? "" : "w-full")}>
      <div className="flex items-center justify-between text-xs">
        <span className={clsx("font-semibold", left === 0 ? "text-danger-600" : low ? "text-[#8a4b06]" : "text-[#23403f]")}>
          {left === 0 ? "Full" : low ? `Only ${left} seat${left === 1 ? "" : "s"} left` : `${left.toLocaleString()} seats left`}
        </span>
        <span className="text-[#4b6362]">{registered.toLocaleString()} / {capacity.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#e1ecea] overflow-hidden" aria-hidden="true">
        <div
          className={clsx("h-full rounded-full", left === 0 ? "bg-danger-500" : low ? "bg-warning-500" : "bg-brand-600")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EventCard({ item }: { item: EventItem }) {
  const { event: e, status, regPhase, registered } = item;
  const full = registered >= e.capacity;
  const canRegister = regPhase === "open" && status !== "completed" && !full;
  const mon = formatInZone(e.starts_at, e.timezone, { month: "short" }).toUpperCase();
  const day = formatInZone(e.starts_at, e.timezone, { day: "2-digit" });
  const weekday = formatInZone(e.starts_at, e.timezone, { weekday: "short" });
  const time = formatTimeRange(e.starts_at, e.ends_at, e.timezone);

  return (
    <article className="card relative p-4 flex gap-4 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_32px_-12px_rgb(11_46_47/0.18)] focus-within:ring-2 focus-within:ring-brand-500">
      <div className="w-14 shrink-0 h-[68px] rounded-[14px] bg-gradient-to-b from-brand-50 to-brand-100 ring-1 ring-brand-200/70 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-[11px] font-bold tracking-wider text-brand-700">{mon}</span>
        <span className="text-[22px] font-extrabold leading-none text-ink">{day}</span>
        <span className="text-[11px] font-semibold text-brand-700">{weekday}</span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx("badge", STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>
          {canRegister && status !== "open" && <span className="badge badge-green">Registration open</span>}
          {regPhase === "open" && full && status !== "completed" && <span className="badge badge-red">Full</span>}
        </div>

        <h3 className="text-base font-bold leading-snug text-ink line-clamp-2">
          {/* Stretched link: the whole card opens the event, while the Register button stays separately tappable. */}
          <Link href={`/events/${e.id}`} className="after:absolute after:inset-0 after:rounded-[1.25rem] focus:outline-none">
            {e.name}
          </Link>
        </h3>

        <p className="text-[13px] text-[#4b6362] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{time}</span>
        </p>
        <p className="text-[13px] text-[#4b6362] flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{e.venue}</span>
        </p>

        {status !== "completed" && (
          <div className="mt-1">
            <SeatsMeter capacity={e.capacity} registered={registered} />
          </div>
        )}

        <div className="mt-2 flex gap-2">
          {canRegister ? (
            <Link href={`/register?event=${e.id}`} className="btn-primary relative z-10 flex-1">
              Register
            </Link>
          ) : (
            <span className="relative z-10 flex-1 btn-secondary pointer-events-none text-[#4b6362]">
              {status === "completed"
                ? "Event ended"
                : regPhase === "before"
                  ? `Registration opens ${formatInZone(e.registration_opens_at, e.timezone, { month: "short", day: "numeric" })}`
                  : full
                    ? "Fully booked"
                    : "Registration closed"}
            </span>
          )}
          <span className="btn-ghost relative w-11 px-0 text-brand-600" aria-hidden="true">
            <ChevronRight className="w-5 h-5" />
          </span>
        </div>
      </div>
    </article>
  );
}

export default function EventBrowser({ items }: { items: EventItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawFilter = params.get("filter");
  const filter: FilterId = FILTERS.some((f) => f.id === rawFilter) ? (rawFilter as FilterId) : "all";
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  // Keep filter + search in the URL so they survive refresh/back and can be shared.
  function update(next: { filter?: FilterId; q?: string }) {
    const sp = new URLSearchParams(params.toString());
    const f = next.filter ?? filter;
    const q = next.q ?? urlQuery;
    if (f === "all") sp.delete("filter"); else sp.set("filter", f);
    if (q.trim()) sp.set("q", q); else sp.delete("q");
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // Debounce search → URL so typing stays smooth.
  useEffect(() => {
    if (query === urlQuery) return;
    const t = setTimeout(() => update({ q: query }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, items.filter(f.match).length])) as Record<FilterId, number>,
    [items],
  );

  const groups = useMemo(() => {
    const active = FILTERS.find((f) => f.id === filter)!;
    const needle = query.trim().toLowerCase();
    const list = items
      .filter(active.match)
      .filter((i) => !needle || [i.event.name, i.event.venue, i.event.organizer].some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => {
        const d = Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at);
        return filter === "past" ? -d : d;
      });
    const map = new Map<string, EventItem[]>();
    for (const i of list) {
      const k = monthKey(i.event);
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return { total: list.length, months: [...map.entries()] };
  }, [items, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events or venues"
          aria-label="Search events"
          enterKeyHint="search"
          className="input pl-11 pr-11"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); update({ q: "" }); }} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#4b6362] hover:bg-slate-100">
            <X className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>

      {/* Filter chips: scroll horizontally on phones, wrap on larger screens */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap" role="group" aria-label="Filter events">
          {FILTERS.map((f) => {
            const active = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => update({ filter: f.id })}
                className={clsx(
                  "min-h-11 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors border",
                  active ? "bg-ink text-white border-ink" : "bg-white text-[#23403f] border-[#cfdedc] hover:border-brand-400",
                )}
              >
                {f.label}
                <span className={clsx("min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center", active ? "bg-white/20" : "bg-[#e1ecea] text-[#23403f]")}>
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{groups.total} event{groups.total === 1 ? "" : "s"} shown</p>

      {groups.total === 0 ? (
        <div className="card p-10 text-center text-[#4b6362] flex flex-col items-center gap-2">
          <CalendarDays className="w-12 h-12 opacity-40" aria-hidden="true" />
          <p className="font-semibold text-ink">
            {query ? `No events match “${query}”.` : filter === "all" ? "No events available right now." : `No ${FILTERS.find((f) => f.id === filter)!.label.toLowerCase()} events.`}
          </p>
          <p className="text-sm">{filter === "all" && !query ? "Check back soon or ask your clinical coordinator." : "Try another filter or clear your search."}</p>
          {(filter !== "all" || query) && (
            <button type="button" onClick={() => { setQuery(""); update({ filter: "all", q: "" }); }} className="btn-secondary mt-2">
              Show all events
            </button>
          )}
        </div>
      ) : (
        groups.months.map(([month, list]) => (
          <section key={month} aria-labelledby={`m-${month}`} className="flex flex-col gap-3">
            <h3 id={`m-${month}`} className="sticky top-16 z-10 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 bg-[#f3f7f6]/95 backdrop-blur text-xs font-bold tracking-[0.08em] uppercase text-[#4b6362]">
              {month} <span className="font-semibold normal-case tracking-normal">· {list.length} event{list.length === 1 ? "" : "s"}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {list.map((item) => <EventCard key={item.event.id} item={item} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
