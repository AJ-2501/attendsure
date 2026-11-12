"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";

/** Labeled client-side event selector with zero full-page reload delay. */
export default function EventPicker({
  events,
  value,
  submitLabel = "View",
}: {
  events: { id: string; name: string }[];
  value: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(value);
  const [pending, startTransition] = useTransition();

  function navigateTo(id: string) {
    if (!id || id === value) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("event", id);
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateTo(selected);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex-1 min-w-0">
        <label htmlFor="event-picker" className="label">Event</label>
        <div className="relative">
          <select
            id="event-picker"
            name="event"
            value={selected}
            disabled={pending}
            onChange={(e) => {
              const nextId = e.target.value;
              setSelected(nextId);
              navigateTo(nextId);
            }}
            className="input appearance-none pr-9"
          >
            {events.length === 0 && <option value="">No events</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
        </div>
      </div>
      <button type="submit" disabled={pending || selected === value} className="btn-primary sm:min-w-28 flex items-center justify-center gap-1.5">
        {pending ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…</> : submitLabel}
      </button>
    </form>
  );
}
