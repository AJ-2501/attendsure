"use client";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema, buildRegistrationSchema, YEAR_LEVELS } from "@/lib/schemas";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronLeft, Eye, EyeOff, Loader2, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { formatInZone } from "@/lib/time";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

interface Me {
  email: string | null;
  staff?: boolean;
  prefill: { fullName: string; studentId: string; section: string; yearLevel: string; department: string } | null;
}

interface FormValues {
  eventId: string;
  fullName: string;
  studentId: string;
  section: string;
  department?: string;
  yearLevel?: string;
  email?: string;
  consent: boolean;
  accountEmail?: string;
  accountPassword?: string;
}

type State = "idle" | "submitting" | "signing-in" | "done" | "error";

/** Staff-facing manual registration (walk-ins). Students use sign-up + one-tap registration instead. */
export default function StaffRegisterForm() {
  // useSearchParams() requires a Suspense boundary.
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error flex items-center gap-1.5" role="alert">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {message}
    </p>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<State>("idle");
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<{ referenceCode: string; participantPath: string; eventName: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [preselect, setPreselect] = useState<string | null>(null);

  const needsAccount = !me; // signed-out visitors create their account here
  const rf = selectedEvent?.required_fields ?? { department: true, year_level: true, email: false };

  const resolver = useMemo<Resolver<FormValues>>(() => {
    const regSchema = buildRegistrationSchema(
      selectedEvent
        ? { studentIdPattern: selectedEvent.student_id_pattern, studentIdHint: selectedEvent.student_id_hint, requiredFields: rf }
        : { studentIdPattern: "^.+$", studentIdHint: "Enter your student ID", requiredFields: rf },
    );
    const regResolver = zodResolver(regSchema) as unknown as Resolver<FormValues>;
    const accResolver = zodResolver(accountSchema) as unknown as Resolver<{ email: string; password: string }>;
    return async (values, ctx, opts) => {
      // When the event needs a school email and we're creating an account, reuse the account email.
      const regValues = needsAccount && rf.email ? { ...values, email: values.accountEmail } : values;
      const reg = await regResolver(regValues, ctx, opts);
      if (!needsAccount) return reg;
      const acc = await accResolver({ email: values.accountEmail ?? "", password: values.accountPassword ?? "" }, ctx, { ...opts, names: undefined, fields: {} });
      const errors = { ...reg.errors };
      if (acc.errors.email) errors.accountEmail = acc.errors.email;
      if (acc.errors.password) errors.accountPassword = acc.errors.password;
      if (Object.keys(errors).length) return { values: {}, errors };
      return { values: { ...(reg.values as FormValues), accountEmail: values.accountEmail, accountPassword: values.accountPassword }, errors: {} };
    };
  }, [selectedEvent, rf, needsAccount]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver, mode: "onTouched", defaultValues: { eventId: "", consent: true } });

  useEffect(() => {
    fetch("/api/register", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        if (!r.ok) throw new Error();
        const list: EventSummary[] = r.data.events;
        setEvents(list);
        setMe(r.data.me);
        const p = r.data.me?.prefill;
        if (p) {
          setValue("fullName", p.fullName);
          setValue("studentId", p.studentId);
          setValue("section", p.section);
          if (p.yearLevel) setValue("yearLevel", p.yearLevel);
          if (p.department) setValue("department", p.department);
        }
        const wanted = searchParams.get("event");
        // Applied after the <option>s render (see effect below), so the select shows it.
        if (wanted && list.some((e) => e.id === wanted)) setPreselect(wanted);
        else if (list.length === 1) setPreselect(list[0].id);
      })
      .catch(() => {
        setState("error");
        setServerMessage("Couldn't load events. Check your connection and refresh the page.");
      })
      .finally(() => setLoadingEvents(false));
  }, [searchParams, setValue]);

  useEffect(() => {
    if (preselect && events.length) setValue("eventId", preselect, { shouldValidate: false });
  }, [preselect, events, setValue]);

  const watchEvent = watch("eventId");
  useEffect(() => {
    setSelectedEvent(events.find((e) => e.id === watchEvent) ?? null);
  }, [watchEvent, events]);

  async function onSubmit(values: FormValues) {
    setState("submitting");
    setServerErrors({});
    setServerMessage(null);
    const { accountEmail, accountPassword, ...registration } = values;
    const payload = {
      ...registration,
      ...(needsAccount && rf.email ? { email: accountEmail } : {}),
      ...(needsAccount ? { account: { email: accountEmail, password: accountPassword } } : {}),
    };
    try {
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.ok) {
        setState("error");
        setServerErrors(json.error?.fields ?? {});
        setServerMessage(json.error?.message ?? "Registration could not be completed. Please try again.");
        return;
      }
      if (json.data.linkedToAccount) {
        if (json.data.accountCreated) {
          setState("signing-in");
          const { error } = await createClient().auth.signInWithPassword({ email: String(accountEmail).trim(), password: String(accountPassword) });
          if (error) {
            // Account exists; fall back to the success screen with a sign-in link.
            setResult(json.data);
            setState("done");
            return;
          }
        }
        router.replace(`/me?registered=${encodeURIComponent(json.data.referenceCode)}`);
        router.refresh();
        return;
      }
      setResult(json.data);
      setState("done");
      window.scrollTo({ top: 0 });
    } catch {
      setState("error");
      setServerMessage("Can't reach the server. Check your connection and try again.");
    }
  }

  const err = (name: keyof FormValues) => errors[name]?.message ?? serverErrors[name]?.[0];
  const aria = (name: keyof FormValues) => ({ "aria-invalid": err(name) ? true : undefined, "aria-describedby": `${name}-msg` });

  if (state === "done" && result) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12 monitor-grid">
        <div className="card p-6 sm:p-8 max-w-md w-full text-center animate-sheet-up">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success-50 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold mb-2">You&apos;re registered!</h1>
          <p className="text-[#4b6362] mb-4">You&apos;ve been registered for <strong>{result.eventName}</strong>.</p>
          <div className="bg-brand-50 rounded-xl p-4 mb-6 font-mono text-lg font-semibold text-brand-700 tracking-widest">{result.referenceCode}</div>
          <div className="flex flex-col gap-3">
            <a href={result.participantPath} className="btn-primary btn-lg w-full">Open my QR pass</a>
            <Link href="/student/login" className="btn-secondary btn-lg w-full">Sign in to my dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const busy = state === "submitting" || state === "signing-in";

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

      <div className="max-w-lg mx-auto px-4 sm:px-0 py-4 sm:py-8 animate-fade-up flex flex-col gap-4">
        {me && !me.staff && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-sm text-[#23403f] flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
            <span>Signed in as <strong>{me.email}</strong>. This registration and its QR pass will appear on your dashboard.</span>
          </div>
        )}
        {me?.staff && (
          <div className="rounded-2xl border border-[#dce7e5] bg-white p-3.5 text-sm text-[#23403f]">
            You&apos;re signed in as admin. This registration won&apos;t be linked to a student account.
          </div>
        )}
        {needsAccount && !loadingEvents && (
          <div className="rounded-2xl border border-[#dce7e5] bg-white p-3.5 text-sm text-[#23403f] flex items-center justify-between gap-3">
            <span>Already have a student account?</span>
            <Link href={`/student/login?next=${encodeURIComponent(`/register${selectedEvent ? `?event=${selectedEvent.id}` : ""}`)}`} className="btn-secondary btn-sm shrink-0">Sign in</Link>
          </div>
        )}

        {selectedEvent && (
          <div className="bg-ink text-white rounded-[18px] p-4 flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-mint">{formatInZone(selectedEvent.starts_at, selectedEvent.timezone)}</span>
            <span className="text-[17px] font-bold">{selectedEvent.name}</span>
            <span className="text-[13px] text-[#a7c9c6]">{selectedEvent.venue}</span>
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <section className="card p-5 sm:p-6 flex flex-col gap-5" aria-labelledby="sec-details">
            <h2 id="sec-details" className="font-bold text-ink flex items-center gap-2">
              <UserRound className="w-[18px] h-[18px] text-brand-600" aria-hidden="true" /> Your details
            </h2>

            <div>
              <label className="label" htmlFor="eventId">Event *</label>
              <div className="relative">
                <select id="eventId" {...register("eventId")} {...aria("eventId")} className="input appearance-none pr-9">
                  <option value="">{loadingEvents ? "Loading events…" : events.length ? "Select an event…" : "No events are open for registration"}</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
              </div>
              <FieldError id="eventId-msg" message={err("eventId")} />
            </div>

            <div>
              <label className="label" htmlFor="fullName">Full name *</label>
              <input id="fullName" {...register("fullName")} {...aria("fullName")} placeholder="Maria Clara Santos" className="input" autoComplete="name" />
              <FieldError id="fullName-msg" message={err("fullName")} />
            </div>

            <div>
              <label className="label" htmlFor="studentId">Student ID *</label>
              <input id="studentId" {...register("studentId")} {...aria("studentId")} placeholder="2020001234" className="input font-mono" autoComplete="off" inputMode="numeric" maxLength={32} spellCheck={false} readOnly={Boolean(me?.prefill)} />
              {err("studentId") ? (
                <FieldError id="studentId-msg" message={err("studentId")} />
              ) : (
                <p id="studentId-msg" className="mt-1 text-xs text-[#4b6362]">
                  {me?.prefill ? "Linked to your account." : selectedEvent?.student_id_hint || "e.g. 2020001234 (10 digits, no dash)"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="label" htmlFor="section">Section *</label>
                <input id="section" {...register("section")} {...aria("section")} placeholder="BSN 2-B" autoCapitalize="characters" className="input" />
                <FieldError id="section-msg" message={err("section")} />
              </div>
              {(rf.year_level || selectedEvent) && (
                <div className="min-w-0">
                  <label className="label" htmlFor="yearLevel">Year level {rf.year_level ? "*" : "(optional)"}</label>
                  <div className="relative">
                    <select id="yearLevel" {...register("yearLevel")} {...aria("yearLevel")} className="input appearance-none pr-9">
                      <option value="">Select…</option>
                      {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
                  </div>
                  <FieldError id="yearLevel-msg" message={err("yearLevel")} />
                </div>
              )}
            </div>

            {(rf.department || selectedEvent) && (
              <div>
                <label className="label" htmlFor="department">College / department {rf.department ? "*" : "(optional)"}</label>
                <input id="department" {...register("department")} {...aria("department")} placeholder="College of Nursing" className="input" />
                <FieldError id="department-msg" message={err("department")} />
              </div>
            )}

            {(rf.email && !needsAccount) && (
              <div>
                <label className="label" htmlFor="email">School email *</label>
                <input id="email" type="email" {...register("email")} {...aria("email")} placeholder="name@nursing.edu.ph" inputMode="email" className="input" autoComplete="email" />
                <FieldError id="email-msg" message={err("email")} />
              </div>
            )}
          </section>

          {needsAccount && (
            <section className="card p-5 sm:p-6 flex flex-col gap-5" aria-labelledby="sec-account">
              <div>
                <h2 id="sec-account" className="font-bold text-ink flex items-center gap-2">
                  <ShieldCheck className="w-[18px] h-[18px] text-brand-600" aria-hidden="true" /> Your account
                </h2>
                <p className="text-sm text-[#4b6362] mt-0.5">Sign in later to see your QR pass and your time-in and time-out records.</p>
              </div>
              <div>
                <label className="label" htmlFor="accountEmail">Email address *</label>
                <input id="accountEmail" type="email" {...register("accountEmail")} {...aria("accountEmail")} placeholder="you@nursing.edu.ph" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className="input" />
                <FieldError id="accountEmail-msg" message={err("accountEmail")} />
              </div>
              <div>
                <label className="label" htmlFor="accountPassword">Create a password *</label>
                <div className="relative">
                  <input id="accountPassword" type={showPassword ? "text" : "password"} {...register("accountPassword")} {...aria("accountPassword")} autoComplete="new-password" className="input pr-14" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#4b6362] hover:bg-slate-100">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {err("accountPassword") ? (
                  <FieldError id="accountPassword-msg" message={err("accountPassword")} />
                ) : (
                  <p id="accountPassword-msg" className="mt-1 text-xs text-[#4b6362]">At least 8 characters, with a letter and a number.</p>
                )}
              </div>
            </section>
          )}

          <label className="flex items-start gap-3 cursor-pointer rounded-[14px] border border-[#dce7e5] bg-white p-3.5">
            <input type="checkbox" {...register("consent")} className="mt-0.5 w-[22px] h-[22px] shrink-0 accent-brand-600" />
            <span className="text-[13px] leading-relaxed text-[#23403f]">
              I agree that my name and student ID are stored encrypted and used only for attendance, per the Data Privacy Act of 2012.
            </span>
          </label>
          <FieldError id="consent-msg" message={err("consent")} />

          {state === "error" && serverMessage && (
            <div role="alert" className="scan-rejected text-sm font-semibold">{serverMessage}</div>
          )}

          <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#f3f7f6]/95 backdrop-blur">
            <button type="submit" disabled={busy || loadingEvents} className="btn-primary btn-lg w-full">
              {state === "submitting" ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
                : state === "signing-in" ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening your dashboard…</>
                : needsAccount ? "Register & create account" : "Register & get my QR pass"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
