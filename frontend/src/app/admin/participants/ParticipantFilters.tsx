"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  events: { id: string; name: string }[];
  activeEventId: string;
  q: string;
  section: string;
  status: string;
}

export default function ParticipantFilters({ events, activeEventId, q, section, status }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [selectedEvent, setSelectedEvent] = useState(activeEventId);
  const [searchQuery, setSearchQuery] = useState(q);
  const [sectionFilter, setSectionFilter] = useState(section);
  const [statusFilter, setStatusFilter] = useState(status);

  function apply(nextEvent?: string) {
    const sp = new URLSearchParams();
    const ev = nextEvent ?? selectedEvent;
    if (ev) sp.set("event", ev);
    if (searchQuery.trim()) sp.set("q", searchQuery.trim());
    if (sectionFilter.trim()) sp.set("section", sectionFilter.trim());
    if (statusFilter) sp.set("status", statusFilter);

    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-3 items-end"
    >
      <div className="col-span-2 lg:col-span-1 min-w-0">
        <label htmlFor="f-event" className="label">Event</label>
        <select
          id="f-event"
          name="event"
          value={selectedEvent}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedEvent(next);
            apply(next);
          }}
          className="input"
        >
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="col-span-2 lg:col-span-1 min-w-0">
        <label htmlFor="f-q" className="label">Search</label>
        <input
          id="f-q"
          type="search"
          name="q"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Name or reference code"
          className="input"
          enterKeyHint="search"
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="f-section" className="label">Section</label>
        <input
          id="f-section"
          name="section"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          placeholder="e.g. BSN-1A"
          className="input"
          autoCapitalize="characters"
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="f-status" className="label">Status</label>
        <select
          id="f-status"
          name="status"
          value={statusFilter}
          disabled={pending}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
        >
          <option value="">All</option>
          <option value="absent">Not arrived</option>
          <option value="checked_in">Checked in</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn-primary col-span-2 lg:col-span-1 flex items-center justify-center gap-1.5">
        {pending ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Filtering…</> : "Apply filters"}
      </button>
    </form>
  );
}
