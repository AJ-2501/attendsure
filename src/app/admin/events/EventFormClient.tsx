"use client";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventSchema, type EventInput } from "@/lib/schemas";
import { zonedLocalToUtc } from "@/lib/time";
import { Loader2, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  defaultValues?: Partial<EventInput>;
  onSubmit: (data: EventInput) => Promise<{ ok: boolean; error?: string; id?: string }>;
  submitLabel: string;
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

/**
 * datetime-local inputs yield wall-clock "YYYY-MM-DDTHH:mm"; the schema needs UTC ISO.
 * Interpret them in the event's time zone before validating.
 */
const eventResolver: Resolver<EventInput> = (values, ctx, opts) => {
  const v: Record<string, unknown> = { ...values };
  for (const k of DATETIME_FIELDS) {
    const raw = v[k];
    if (raw === "" || raw === undefined) v[k] = k.startsWith("timeOut") ? null : raw;
    else if (typeof raw === "string" && LOCAL_DT.test(raw)) {
      try {
        v[k] = zonedLocalToUtc(raw, values.timezone);
      } catch {
        // invalid time zone: leave as-is so the schema reports it
      }
    }
  }
  return (zodResolver(eventSchema) as unknown as Resolver<EventInput>)(v as EventInput, ctx, opts);
};

function F({ id, label, error, required, children }: { id: string; label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}{required && " *"}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export default function EventFormClient({ defaultValues, onSubmit, submitLabel }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventInput>({
    resolver: eventResolver,
    defaultValues: {
      status: "draft",
      timezone: "Asia/Manila",
      timeOutQrTtlMinutes: 15,
      capacity: 500,
      allowTimeIn: true,
      allowTimeOut: true,
      requireTimeOut: true,
      studentIdPattern: "^[0-9]{4}-[0-9]{5}$",
      studentIdHint: "Format: 2024-12345",
      requiredFields: { department: true, year_level: true, email: false },
      ...defaultValues,
    },
  });

  async function submit(data: EventInput) {
    setLoading(true);
    setServerError(null);
    try {
      const result = await onSubmit(data);
      if (result.ok && result.id) {
        router.push(`/admin/events/${result.id}`);
        router.refresh();
      } else setServerError(result.error ?? "An error occurred.");
    } catch {
      setServerError("Could not save the event. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Basic Information</h2>
        <F id="name" label="Event Name" required error={errors.name?.message}>
          <input id="name" {...register("name")} className="input" placeholder="Annual Sports Fest 2027" />
        </F>
        <F id="description" label="Description" error={errors.description?.message}>
          <textarea id="description" {...register("description")} className="input min-h-[80px] resize-y" placeholder="Brief description of the event…" />
        </F>
        <div className="grid grid-cols-2 gap-4">
          <F id="venue" label="Venue" required error={errors.venue?.message}>
            <input id="venue" {...register("venue")} className="input" placeholder="Gymnasium, Main Campus" />
          </F>
          <F id="organizer" label="Organizer" error={errors.organizer?.message}>
            <input id="organizer" {...register("organizer")} className="input" placeholder="Student Affairs Office" />
          </F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F id="capacity" label="Capacity" required error={errors.capacity?.message}>
            <input id="capacity" type="number" {...register("capacity")} className="input" />
          </F>
          <F id="timezone" label="Time Zone" error={errors.timezone?.message}>
            <div className="relative">
              <select id="timezone" {...register("timezone")} className="input appearance-none pr-8">
                {TZ_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </F>
        </div>
        <F id="status" label="Status" required error={errors.status?.message}>
          <div className="relative">
            <select id="status" {...register("status")} className="input appearance-none pr-8">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </F>
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Schedule (local to selected time zone)</h2>
        <div className="grid grid-cols-2 gap-4">
          <F id="startsAt" label="Event Start" required error={errors.startsAt?.message}>
            <input id="startsAt" type="datetime-local" {...register("startsAt")} className="input" />
          </F>
          <F id="endsAt" label="Event End" required error={errors.endsAt?.message}>
            <input id="endsAt" type="datetime-local" {...register("endsAt")} className="input" />
          </F>
          <F id="registrationOpensAt" label="Registration Opens" required error={errors.registrationOpensAt?.message}>
            <input id="registrationOpensAt" type="datetime-local" {...register("registrationOpensAt")} className="input" />
          </F>
          <F id="registrationClosesAt" label="Registration Closes" required error={errors.registrationClosesAt?.message}>
            <input id="registrationClosesAt" type="datetime-local" {...register("registrationClosesAt")} className="input" />
          </F>
          <F id="timeInOpensAt" label="Time-In Window Opens" required error={errors.timeInOpensAt?.message}>
            <input id="timeInOpensAt" type="datetime-local" {...register("timeInOpensAt")} className="input" />
          </F>
          <F id="timeInClosesAt" label="Time-In Window Closes" required error={errors.timeInClosesAt?.message}>
            <input id="timeInClosesAt" type="datetime-local" {...register("timeInClosesAt")} className="input" />
          </F>
        </div>
        <F id="timeOutQrTtlMinutes" label="Time-Out QR Valid for (minutes)" required error={errors.timeOutQrTtlMinutes?.message}>
          <input id="timeOutQrTtlMinutes" type="number" {...register("timeOutQrTtlMinutes")} className="input max-w-[120px]" />
        </F>
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Attendance Settings</h2>
        <div className="space-y-3">
          {[
            { name: "allowTimeIn", label: "Allow Time In" },
            { name: "allowTimeOut", label: "Allow Time Out" },
            { name: "requireTimeOut", label: "Require Time Out for completion" },
          ].map(({ name, label }) => (
            <label key={name} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register(name as keyof EventInput)} className="accent-brand-600 w-4 h-4" />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F id="studentIdPattern" label="Student ID Pattern (regex)" required error={errors.studentIdPattern?.message}>
            <input id="studentIdPattern" {...register("studentIdPattern")} className="input font-mono text-xs" />
          </F>
          <F id="studentIdHint" label="Student ID Hint" error={errors.studentIdHint?.message}>
            <input id="studentIdHint" {...register("studentIdHint")} className="input" placeholder="Format: 2024-12345" />
          </F>
        </div>
        <div>
          <p className="label mb-2">Required Registration Fields</p>
          <div className="flex flex-wrap gap-4">
            {[
              { name: "requiredFields.department", label: "Department" },
              { name: "requiredFields.year_level", label: "Year Level" },
              { name: "requiredFields.email", label: "School Email" },
            ].map(({ name, label }) => (
              <label key={name} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register(name as keyof EventInput)} className="accent-brand-600 w-4 h-4" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {serverError && <div className="scan-rejected text-sm">{serverError}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary btn-lg">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : submitLabel}
        </button>
        <Link href="/admin/events" className="btn-secondary btn-lg">Cancel</Link>
      </div>
    </form>
  );
}
