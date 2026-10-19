import { ChevronDown } from "lucide-react";

/** Labeled GET form for choosing the event a report page shows. Stacks on phones. */
export default function EventPicker({ events, value, submitLabel = "View" }: { events: { id: string; name: string }[]; value: string; submitLabel?: string }) {
  return (
    <form method="GET" className="card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex-1 min-w-0">
        <label htmlFor="event-picker" className="label">Event</label>
        <div className="relative">
          <select id="event-picker" name="event" defaultValue={value} className="input appearance-none pr-9">
            {events.length === 0 && <option value="">No events</option>}
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
        </div>
      </div>
      <button type="submit" className="btn-primary sm:min-w-28">{submitLabel}</button>
    </form>
  );
}
