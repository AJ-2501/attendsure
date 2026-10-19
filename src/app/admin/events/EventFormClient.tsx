"use client";
import { useState } from "react";
import { useForm, type FieldErrors, type Resolver, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventSchema, type EventInput } from "@/lib/schemas";
import { zonedLocalToUtc } from "@/lib/time";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";

export type EventFormResult = { ok: boolean; error?: string; id?: string; fields?: Record<string, string[]> };

interface Props {
  defaultValues?: Partial<EventInput>;
  onSubmit: (data: EventInput) => Promise<EventFormResult>;
  submitLabel: string;
  cancelHref?: string;
}

const TZ_OPTIONS = [
  "Asia/Manila", "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Jakarta",
  "Asia/Tokyo", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London",
];

const DATETIME_FIELDS = [
  "startsAt", "endsAt", "registrationOpensAt", "registrationClosesAt",
  "timeInOpensAt", "timeInClosesAt", "timeOutOpensAt", "timeOutClosesAt",
] as const;
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const LABELS: Record<string, string> = {
  name: "Event name", description: "Description", venue: "Venue", organizer: "Organizer", timezone: "Time zone",
  startsAt: "Event start", endsAt: "Event end", registrationOpensAt: "Registration opens", registrationClosesAt: "Registration closes",
  timeInOpensAt: "Time-in opens", timeInClosesAt: "Time-in closes", timeOutOpensAt: "Time-out opens", timeOutClosesAt: "Time-out closes",
  timeOutQrTtlMinutes: "Time-out QR validity", capacity: "Capacity", allowTimeIn: "Attendance actions",
  studentIdPattern: "Student ID pattern", studentIdHint: "Student ID hint", status: "Status",
};

/**
 * datetime-local inputs yield wall-clock "YYYY-MM-DDTHH:mm"; the schema needs UTC ISO.
 * Interpret them in the event's time zone before validating. Empty required dates get a clear message.
 */
const eventResolver: Resolver<EventInput> = async (values, ctx, opts) => {
  const v: Record<string, unknown> = { ...values };
  const missing: FieldErrors<EventInput> = {};
  for (const k of DATETIME_FIELDS) {
    const raw = v[k];
    if (raw === "" || raw === undefined || raw === null) {
      if (k.startsWith("timeOut")) v[k] = null;
      else (missing as Record<string, unknown>)[k] = { type: "required", message: "Required" };
    } else if (typeof raw === "string" && LOCAL_DT.test(raw)) {
      try {
        v[k] = zonedLocalToUtc(raw, values.timezone);
      } catch {
        // invalid time zone: leave as-is so the schema reports it
      }
    }
  }
  const result = await (zodResolver(eventSchema) as unknown as Resolver<EventInput>)(v as EventInput, ctx, opts);
  if (Object.keys(missing).length) return { values: {}, errors: { ...result.errors, ...missing } };
  return result;
};

function F({ id, label, error, required, hint, children, className }: { id: string; label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="text-danger-600" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="field-error flex items-center gap-1" role="alert"><AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[#4b6362]">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
      <div>
        <h2 className="font-bold text-ink">{title}</h2>
        {description && <p className="text-sm text-[#4b6362] mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ id, label, description, field }: { id: string; label: string; description: string; field: UseFormRegisterReturn }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer rounded-2xl border border-[#dce7e5] bg-[#f3f7f6] p-3.5 min-h-11 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50">
      <input id={id} type="checkbox" {...field} className="mt-0.5 w-[22px] h-[22px] shrink-0 accent-brand-600" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-[#4b6362]">{description}</span>
      </span>
    </label>
  );
}

export default function EventFormClient({ defaultValues, onSubmit, submitLabel, cancelHref = "/admin/events" }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EventInput>({
    resolver: eventResolver,
    mode: "onTouched",
    defaultValues: {
      status: "draft",
      timezone: "Asia/Manila",
      timeOutQrTtlMinutes: 15,
      capacity: 500,
      allowTimeIn: true,
      allowTimeOut: true,
      requireTimeOut: true,
      studentIdPattern: "^[0-9]{10}$",
      studentIdHint: "Format: 2021001955 (10 digits, no dash)",
      requiredFields: { department: true, year_level: true, email: false },
      ...defaultValues,
    },
  });

  function onInvalid(errs: FieldErrors<EventInput>) {
    const keys = Object.keys(errs);
    setSummary(keys.map((k) => LABELS[k] ?? k));
    // Move focus (and the viewport) to the first problem.
    const first = [...DATETIME_FIELDS, ...Object.keys(LABELS)].find((k) => keys.includes(k)) ?? keys[0];
    if (first) setFocus(first as keyof EventInput, { shouldSelect: false });
  }

  async function submit(data: EventInput) {
    setServerError(null);
    setSummary([]);
    try {
      const result = await onSubmit(data);
      if (result.ok && result.id) {
        router.push(`/admin/events/${result.id}?saved=1`);
        router.refresh();
        return;
      }
      for (const [k, msgs] of Object.entries(result.fields ?? {})) setError(k as keyof EventInput, { message: msgs[0] });
      setServerError(result.error ?? "Could not save the event.");
    } catch {
      setServerError("Could not save the event. Check your connection and try again.");
    }
  }

  const dt = (id: keyof EventInput, label: string, required = true, hint?: string) => (
    <F id={id} label={label} required={required} error={errors[id]?.message} hint={hint}>
      <input id={id} type="datetime-local" {...register(id)} aria-invalid={errors[id] ? true : undefined} className="input min-w-0" />
    </F>
  );

  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} className="flex flex-col gap-4 sm:gap-6 max-w-3xl" noValidate>
      {summary.length > 0 && (
        <div role="alert" className="scan-rejected text-sm">
          <p className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" aria-hidden="true" /> Fix {summary.length} field{summary.length === 1 ? "" : "s"} to continue</p>
          <p className="mt-1">{summary.join(" · ")}</p>
        </div>
      )}

      <Section title="Event details">
        <F id="name" label="Event name" required error={errors.name?.message}>
          <input id="name" {...register("name")} className="input" placeholder="Basic Life Support Refresher" />
        </F>
        <F id="description" label="Description" error={errors.description?.message} hint="Shown on the public event page.">
          <textarea id="description" {...register("description")} rows={3} className="input min-h-24 resize-y" placeholder="What students should know or bring…" />
        </F>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F id="venue" label="Venue" required error={errors.venue?.message}>
            <input id="venue" {...register("venue")} className="input" placeholder="Skills Lab 2, CON Building" />
          </F>
          <F id="organizer" label="Organizer" error={errors.organizer?.message}>
            <input id="organizer" {...register("organizer")} className="input" placeholder="College of Nursing" />
          </F>
          <F id="capacity" label="Capacity" required error={errors.capacity?.message} hint="Maximum number of registrations.">
            <input id="capacity" type="number" inputMode="numeric" min={1} {...register("capacity")} className="input" />
          </F>
          <F id="status" label="Status" required error={errors.status?.message} hint="Only published events are visible to students.">
            <div className="relative">
              <select id="status" {...register("status")} className="input appearance-none pr-9">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
            </div>
          </F>
        </div>
      </Section>

      <Section title="Schedule" description="Enter times in the event's time zone.">
        <F id="timezone" label="Time zone" error={errors.timezone?.message}>
          <div className="relative">
            <select id="timezone" {...register("timezone")} className="input appearance-none pr-9">
              {TZ_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
          </div>
        </F>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <legend className="sr-only">Event</legend>
          {dt("startsAt", "Event starts")}
          {dt("endsAt", "Event ends")}
        </fieldset>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#eef4f3]">
          <legend className="sr-only">Registration window</legend>
          {dt("registrationOpensAt", "Registration opens")}
          {dt("registrationClosesAt", "Registration closes")}
        </fieldset>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#eef4f3]">
          <legend className="sr-only">Time-in window</legend>
          {dt("timeInOpensAt", "Time-in opens")}
          {dt("timeInClosesAt", "Time-in closes")}
        </fieldset>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#eef4f3]">
          <legend className="sr-only">Time-out window</legend>
          {dt("timeOutOpensAt", "Time-out opens", false, "Optional. Defaults to the event start.")}
          {dt("timeOutClosesAt", "Time-out closes", false, "Optional. Defaults to 2 hours after the event ends.")}
        </fieldset>
      </Section>

      <Section title="Attendance">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Toggle id="allowTimeIn" label="Time in" description="Scan students at arrival." field={register("allowTimeIn")} />
          <Toggle id="allowTimeOut" label="Time out" description="Scan students when leaving." field={register("allowTimeOut")} />
          <Toggle id="requireTimeOut" label="Require time out" description="Needed for complete attendance." field={register("requireTimeOut")} />
        </div>
        {errors.allowTimeIn?.message && <p className="field-error -mt-2" role="alert">{errors.allowTimeIn.message}</p>}
        <F id="timeOutQrTtlMinutes" label="Time-out QR valid for (minutes)" required error={errors.timeOutQrTtlMinutes?.message} className="sm:max-w-xs">
          <input id="timeOutQrTtlMinutes" type="number" inputMode="numeric" min={1} max={1440} {...register("timeOutQrTtlMinutes")} className="input" />
        </F>
      </Section>

      <Section title="Registration form" description="What students must enter when registering.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F id="studentIdHint" label="Student ID hint" error={errors.studentIdHint?.message} hint="Shown under the Student ID field.">
            <input id="studentIdHint" {...register("studentIdHint")} className="input" placeholder="Format: 2021001955 (10 digits, no dash)" />
          </F>
          <F id="studentIdPattern" label="Student ID pattern" required error={errors.studentIdPattern?.message} hint="Advanced: regular expression. ^[0-9]{10}$ = 10 digits.">
            <input id="studentIdPattern" {...register("studentIdPattern")} className="input font-mono" spellCheck={false} autoCapitalize="none" />
          </F>
        </div>
        <div>
          <p className="label">Also required</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Toggle id="rf-department" label="Department" description="College / department." field={register("requiredFields.department")} />
            <Toggle id="rf-year" label="Year level" description="1st to 5th year." field={register("requiredFields.year_level")} />
            <Toggle id="rf-email" label="School email" description="Must be a school address." field={register("requiredFields.email")} />
          </div>
        </div>
      </Section>

      {serverError && <div role="alert" className="scan-rejected text-sm font-semibold">{serverError}</div>}

      {/* Sticky action bar: stays above the mobile tab bar, inline on desktop. */}
      <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-4 z-10 -mx-4 sm:mx-0 px-4 py-3 sm:p-3 bg-white/95 backdrop-blur border-y sm:border border-[#dce7e5] sm:rounded-2xl shadow-[0_-4px_16px_rgb(11_46_47/0.06)] flex gap-3">
        <Link href={cancelHref} className="btn-secondary btn-lg flex-1 sm:flex-none">Cancel</Link>
        <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg flex-[2] sm:flex-none sm:min-w-44">
          {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : submitLabel}
        </button>
        {isDirty && <span className="hidden sm:flex items-center text-xs text-[#4b6362]">Unsaved changes</span>}
      </div>
    </form>
  );
}
