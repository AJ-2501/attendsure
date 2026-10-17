"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buildRegistrationSchema, YEAR_LEVELS } from "@/lib/schemas";
import { CheckCircle, ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatInZone } from "@/lib/time";
import { useSearchParams } from "next/navigation";

interface EventSummary {
  id: string;
  name: string;
  venue: string;
  starts_at: string;
  status: string;
  student_id_pattern: string;
  student_id_hint: string;
  required_fields: { department: boolean; year_level: boolean; email: boolean };
  timezone: string;
}

type State = "idle" | "submitting" | "done" | "error";

export default function RegisterPage() {
  // useSearchParams() requires a Suspense boundary for static prerendering.
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [state, setState] = useState<State>("idle");
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ referenceCode: string; participantPath: string; eventName: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rf = selectedEvent?.required_fields ?? { department: true, year_level: true, email: false };
  const rules = selectedEvent
    ? { studentIdPattern: selectedEvent.student_id_pattern, studentIdHint: selectedEvent.student_id_hint, requiredFields: rf }
    : { studentIdPattern: "^.+$", studentIdHint: "Enter your student ID", requiredFields: rf };

  const schema = buildRegistrationSchema(rules);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { eventId: selectedEvent?.id ?? "", consent: true as const } });

  useEffect(() => {
    fetch("/api/register")
      .then((r) => r.json())
      .then((r) => {
        if (r.ok) {
          setEvents(r.data);
          const preselect = searchParams.get("event");
          // Set the form value; the effect below syncs selectedEvent from it.
          if (preselect && r.data.some((e: EventSummary) => e.id === preselect)) setValue("eventId", preselect);
        }
      })
      .catch(() => setState("error"));
  }, [searchParams, setValue]);

  const watchEvent = watch("eventId");
  useEffect(() => {
    const ev = events.find((e) => e.id === watchEvent) ?? null;
    setSelectedEvent(ev);
  }, [watchEvent, events]);

  async function onSubmit(data: unknown) {
    setState("submitting");
    setServerErrors({});
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.ok) {
      setResult(json.data);
      setState("done");
      redirectTimer.current = setTimeout(() => {
        window.location.href = json.data.participantPath;
      }, 3000);
    } else {
      setState("error");
      setServerErrors(json.error?.fields ?? {});
    }
  }

  if (state === "done" && result) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12 monitor-grid">
        <div className="card p-8 max-w-md w-full text-center animate-sheet-up">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success-50 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">You&apos;re registered!</h1>
          <p className="text-slate-500 mb-4">
            You&apos;ve been registered for <strong>{result.eventName}</strong>.
          </p>
          <div className="bg-brand-50 rounded-xl p-4 mb-6 font-mono text-lg font-semibold text-brand-700 tracking-widest">
            {result.referenceCode}
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Redirecting to your QR codes in 3 seconds…
          </p>
          <a href={result.participantPath} className="btn-primary btn-lg w-full">
            Open my QR pass
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-white border-b border-[#dce7e5] pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto h-14 px-2 flex items-center gap-1">
          <Link href="/" aria-label="Back to events" className="btn-ghost w-11 h-11 p-0">
            <ChevronLeft className="w-[22px] h-[22px]" />
          </Link>
          <h1 className="text-[17px] font-bold text-ink">Event registration</h1>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 sm:px-0 py-4 sm:py-8 animate-fade-up">
        {selectedEvent && (
          <div className="bg-ink text-white rounded-[18px] p-4 mb-4 flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-mint">
              {formatInZone(selectedEvent.starts_at, selectedEvent.timezone)}
            </span>
            <span className="text-[17px] font-bold">{selectedEvent.name}</span>
            <span className="text-[13px] text-[#a7c9c6]">{selectedEvent.venue}</span>
          </div>
        )}

        <form className="card p-5 sm:p-8 flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
          {/* Event select */}
          <div>
            <label className="label" htmlFor="eventId">Event *</label>
            <div className="relative">
              <select id="eventId" {...register("eventId")} className="input appearance-none pr-9">
                <option value="">Select an event…</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" />
            </div>
            {(errors.eventId || serverErrors.eventId) && (
              <p className="field-error">{errors.eventId?.message ?? serverErrors.eventId?.[0]}</p>
            )}
          </div>

          {/* Full name */}
          <div>
            <label className="label" htmlFor="fullName">Full Name *</label>
            <input id="fullName" {...register("fullName")} placeholder="Maria Clara Santos" className="input" autoComplete="name" />
            {(errors.fullName || serverErrors.fullName) && (
              <p className="field-error">{errors.fullName?.message ?? serverErrors.fullName?.[0]}</p>
            )}
          </div>

          {/* Student ID */}
          <div>
            <label className="label" htmlFor="studentId">Student ID *</label>
            <input id="studentId" {...register("studentId")} placeholder={selectedEvent?.student_id_hint ?? "Enter your student ID"} className="input font-mono" autoComplete="off" inputMode="numeric" autoCapitalize="characters" />
            {(errors.studentId || serverErrors.studentId) && (
              <p className="field-error">{errors.studentId?.message ?? serverErrors.studentId?.[0]}</p>
            )}
          </div>

          {/* Section */}
          <div>
            <label className="label" htmlFor="section">Section *</label>
            <input id="section" {...register("section")} placeholder="BSN 2-B" autoCapitalize="characters" className="input" />
            {(errors.section || serverErrors.section) && (
              <p className="field-error">{errors.section?.message ?? serverErrors.section?.[0]}</p>
            )}
          </div>

          {/* Department */}
          {(rf.department || selectedEvent) && (
            <div>
              <label className="label" htmlFor="department">
                College / Department {rf.department ? "*" : "(optional)"}
              </label>
              <input id="department" {...register("department")} placeholder="College of Nursing" className="input" />
              {(errors.department || serverErrors.department) && (
                <p className="field-error">{errors.department?.message ?? serverErrors.department?.[0]}</p>
              )}
            </div>
          )}

          {/* Year Level */}
          {(rf.year_level || selectedEvent) && (
            <div>
              <label className="label" htmlFor="yearLevel">
                Year Level {rf.year_level ? "*" : "(optional)"}
              </label>
              <div className="relative">
                <select id="yearLevel" {...register("yearLevel")} className="input appearance-none pr-9">
                  <option value="">Select year level…</option>
                  {YEAR_LEVELS.map((y) => (<option key={y} value={y}>{y}</option>))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" />
              </div>
              {(errors.yearLevel || serverErrors.yearLevel) && (
                <p className="field-error">{errors.yearLevel?.message ?? serverErrors.yearLevel?.[0]}</p>
              )}
            </div>
          )}

          {/* Email */}
          {(rf.email || selectedEvent) && (
            <div>
              <label className="label" htmlFor="email">
                School Email {rf.email ? "*" : "(optional)"}
              </label>
              <input id="email" type="email" {...register("email")} placeholder="name@nursing.edu.ph" inputMode="email" className="input" autoComplete="email" />
              {(errors.email || serverErrors.email) && (
                <p className="field-error">{errors.email?.message ?? serverErrors.email?.[0]}</p>
              )}
            </div>
          )}

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer rounded-[14px] border border-[#dce7e5] bg-[#f3f7f6] p-3.5">
            <input type="checkbox" {...register("consent")} className="mt-0.5 w-[22px] h-[22px] shrink-0 accent-brand-600" />
            <span className="text-[13px] leading-relaxed text-[#23403f]">
              I understand that my name and student ID will be stored securely to track my attendance at this event.
            </span>
          </label>
          {errors.consent && <p className="field-error -mt-3">{errors.consent.message}</p>}

          {/* General error */}
          {state === "error" && !Object.keys(serverErrors).length && (
            <div className="scan-rejected text-sm">Registration could not be completed. Please check your details and try again.</div>
          )}

          <div className="sticky bottom-0 -mx-5 sm:mx-0 -mb-5 sm:mb-0 px-5 sm:px-0 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-0 bg-white border-t sm:border-0 border-[#dce7e5] rounded-b-[1.25rem]">
            <button type="submit" disabled={state === "submitting"} className="btn-primary btn-lg w-full">
              {state === "submitting" ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</> : "Get my QR pass"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
