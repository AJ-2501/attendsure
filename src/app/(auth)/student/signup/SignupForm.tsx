"use client";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ChevronDown, ShieldCheck, UserRound } from "lucide-react";
import { STUDENT_ID_EXAMPLE, studentDetailsSchema, YEAR_LEVELS, type StudentDetailsInput } from "@/lib/schemas";
import { GoogleButtonFace, googleButtonClass, startGoogleSignIn, useResetOnPageShow } from "@/components/GoogleSignInButton";

type FormValues = StudentDetailsInput;

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="field-error flex items-center gap-1.5" role="alert">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1 text-xs text-[#4b6362]">{hint}</p>
      ) : null}
    </div>
  );
}

export default function SignupForm({
  event,
  initial = null,
  initialError = null,
}: {
  event?: { id: string; name: string } | null;
  /** Details from an unfinished attempt (e.g. the student cancelled Google), so nothing has to be retyped. */
  initial?: FormValues | null;
  initialError?: string | null;
}) {
  const [formError, setFormError] = useState<string | null>(initialError);
  const [redirecting, setRedirecting] = useState(false);
  useResetOnPageShow(useCallback(() => setRedirecting(false), []));
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(studentDetailsSchema),
    mode: "onTouched",
    defaultValues: initial ?? { department: "College of Nursing and Pharmacy", consent: true },
  });

  function showFormError(msg: string) {
    setFormError(msg);
    requestAnimationFrame(() => document.getElementById("signup-error")?.focus());
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      // Step 1: the server checks and holds the details; step 2: Google creates the account, then the callback saves them.
      const res = await fetch("/api/student/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, eventId: event?.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        const fields = (json.error?.fields ?? {}) as Record<string, string[]>;
        const names = Object.keys(fields);
        for (const name of names) setError(name as keyof FormValues, { message: fields[name][0] });
        if (names[0]) {
          setFormError(json.error?.message ?? "Please check the highlighted fields.");
          setFocus(names[0] as keyof FormValues);
        } else showFormError(json.error?.message ?? "Couldn't continue. Please try again.");
        return;
      }
      setRedirecting(true);
      await startGoogleSignIn({ from: "signup" });
    } catch {
      setRedirecting(false);
      showFormError("Can't reach the server. Check your connection and try again.");
    }
  }

  const aria = (name: keyof FormValues, hasHint = false) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] || hasHint ? `${name}-msg` : undefined,
  });
  const busy = isSubmitting || redirecting;

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (errs) => {
        const first = Object.keys(errs)[0] as keyof FormValues | undefined;
        if (first) setFocus(first);
      })}
      className="flex flex-col gap-5"
      noValidate
    >
      {event && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-sm text-[#23403f]">
          You&apos;ll also be registered for <strong>{event.name}</strong> and get its QR pass right away.
        </div>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="font-bold text-ink flex items-center gap-2 mb-1">
          <UserRound className="w-[18px] h-[18px] text-brand-600" aria-hidden="true" /> Your details
        </legend>
        <Field id="fullName" label="Full name" hint="e.g. Juan Dela Cruz" error={errors.fullName?.message}>
          <input id="fullName" {...register("fullName")} {...aria("fullName", true)} autoComplete="name" maxLength={120} className="input bg-[#f3f7f6]" placeholder="First and last name" />
        </Field>
        <Field id="studentId" label="Student ID" hint={`10 digits, no dash — e.g. ${STUDENT_ID_EXAMPLE}`} error={errors.studentId?.message}>
          <input id="studentId" {...register("studentId")} {...aria("studentId", true)} inputMode="numeric" autoComplete="off" maxLength={12} spellCheck={false} className="input font-mono bg-[#f3f7f6]" placeholder={`e.g. ${STUDENT_ID_EXAMPLE}`} />
        </Field>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
          <Field id="section" label="Section" hint="e.g. BSN-1A" error={errors.section?.message}>
            <input id="section" {...register("section")} {...aria("section", true)} autoCapitalize="characters" maxLength={40} className="input bg-[#f3f7f6]" placeholder="e.g. BSN-1A" />
          </Field>
          <Field id="yearLevel" label="Year level" error={errors.yearLevel?.message}>
            <div className="relative">
              <select id="yearLevel" {...register("yearLevel")} {...aria("yearLevel")} className="input appearance-none pr-9 bg-[#f3f7f6]" defaultValue="">
                <option value="" disabled>Select…</option>
                {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#4b6362] pointer-events-none" aria-hidden="true" />
            </div>
          </Field>
        </div>
        <Field id="department" label="College / department" error={errors.department?.message}>
          <input id="department" {...register("department")} {...aria("department")} maxLength={120} className="input bg-[#f3f7f6]" />
        </Field>
      </fieldset>


      <div>
        <label htmlFor="consent" className="flex items-start gap-3 cursor-pointer rounded-[14px] border border-[#dce7e5] bg-[#f3f7f6] p-3.5">
          <input id="consent" type="checkbox" {...register("consent")} {...aria("consent")} className="mt-0.5 w-[22px] h-[22px] shrink-0 accent-brand-600" />
          <span className="text-[13px] leading-relaxed text-[#23403f]">I agree that my name and student ID are stored encrypted and used only for attendance, per the Data Privacy Act of 2012.</span>
        </label>
        {errors.consent?.message && (
          <p id="consent-msg" className="field-error flex items-center gap-1.5" role="alert">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {errors.consent.message}
          </p>
        )}
      </div>

      {formError && (
        <div
          id="signup-error"
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-500/20 rounded-xl px-3 py-2.5 outline-none"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5 pt-4 border-t border-[#eef4f3]">
        <p className="flex items-start gap-2.5 text-base leading-snug font-medium text-[#23403f]">
          <ShieldCheck className="w-5 h-5 shrink-0 mt-px text-brand-600" aria-hidden="true" />
          <span className="min-w-0 break-words">Next, sign in with your UA student Google account.</span>
        </p>
        <button type="submit" disabled={busy} aria-busy={busy} className={googleButtonClass}>
          <GoogleButtonFace busy={busy} label={event ? "Register with Google" : "Continue with Google"} busyLabel={isSubmitting ? "Checking your details…" : "Opening Google…"} />
        </button>
      </div>
    </form>
  );
}
