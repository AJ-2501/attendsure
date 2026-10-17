import type { EffectiveStatus, EventRow } from "./types";

/** Mirrors SQL public.event_effective_status(). */
export function effectiveStatus(
  e: Pick<EventRow, "status" | "starts_at" | "ends_at" | "registration_opens_at" | "registration_closes_at">,
  now: Date = new Date(),
): EffectiveStatus {
  if (e.status === "cancelled") return "cancelled";
  if (e.status === "draft") return "draft";
  const t = now.getTime();
  if (t >= Date.parse(e.ends_at)) return "completed";
  if (t >= Date.parse(e.starts_at)) return "ongoing";
  if (t >= Date.parse(e.registration_opens_at) && t < Date.parse(e.registration_closes_at)) return "open";
  return "upcoming";
}

export function isRegistrationOpen(
  e: Pick<EventRow, "status" | "registration_opens_at" | "registration_closes_at">,
  now: Date = new Date(),
) {
  const t = now.getTime();
  return e.status === "published" && t >= Date.parse(e.registration_opens_at) && t < Date.parse(e.registration_closes_at);
}

export function timeOutWindow(e: Pick<EventRow, "starts_at" | "ends_at" | "time_out_opens_at" | "time_out_closes_at">) {
  return {
    opens: e.time_out_opens_at ?? e.starts_at,
    closes: e.time_out_closes_at ?? new Date(Date.parse(e.ends_at) + 2 * 3600_000).toISOString(),
  };
}

/** Badge class per status (see .badge-* in globals.css). */
export const STATUS_BADGE: Record<EffectiveStatus, string> = {
  open: "badge-green",
  ongoing: "badge-blue",
  upcoming: "badge-yellow",
  completed: "badge-gray",
  cancelled: "badge-red",
  draft: "badge-gray",
};

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  open: "Open for Registration",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Format a UTC instant in the event's IANA time zone. */
export function formatInZone(iso: string | null | undefined, timeZone: string, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "—";
  const o = Object.keys(opts).length ? opts : { dateStyle: "medium" as const, timeStyle: "short" as const };
  return new Intl.DateTimeFormat("en-PH", { timeZone, ...o }).format(new Date(iso));
}

/** "9:00 AM – 12:00 PM" on one day, otherwise "Oct 10, 9:00 AM – Oct 12, 5:00 PM". */
export function formatTimeRange(startIso: string, endIso: string, timeZone: string) {
  const day = (iso: string) => formatInZone(iso, timeZone, { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = (iso: string) => formatInZone(iso, timeZone, { timeStyle: "short" });
  if (day(startIso) === day(endIso)) return `${time(startIso)} – ${time(endIso)}`;
  const dt = (iso: string) => formatInZone(iso, timeZone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${dt(startIso)} – ${dt(endIso)}`;
}

/** Where `now` sits relative to the registration window (mirrors register_participant's check). */
export function registrationPhase(
  e: Pick<EventRow, "registration_opens_at" | "registration_closes_at">,
  now: Date = new Date(),
): "before" | "open" | "after" {
  const t = now.getTime();
  if (t < Date.parse(e.registration_opens_at)) return "before";
  return t < Date.parse(e.registration_closes_at) ? "open" : "after";
}

export function zoneAbbrev(timeZone: string, at: Date = new Date()) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/**
 * Convert a wall-clock "YYYY-MM-DDTHH:mm" in an IANA zone to a UTC ISO string.
 * Uses Intl to find the zone offset at that instant (handles DST).
 */
export function zonedLocalToUtc(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Invalid local datetime");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (ts: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(ts))
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return asUtc - ts;
  };
  let ts = guess - offset(guess);
  ts = guess - offset(ts); // second pass for DST boundaries
  return new Date(ts).toISOString();
}

/** Inverse of zonedLocalToUtc for populating datetime-local inputs. */
export function utcToZonedLocal(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
