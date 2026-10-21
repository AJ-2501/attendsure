"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ChevronDown, Eye, EyeOff, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { STUDENT_ID_EXAMPLE, studentProfileSchema, YEAR_LEVELS } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";

const formSchema = studentProfileSchema
  .extend({ confirmPassword: z.string().min(1, "Re-enter your password") })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
type FormValues = z.input<typeof formSchema>;

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

export default function SignupForm({ event }: { event?: { id: string; name: string } | null }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "signing-in">("idle");
  const alertRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    trigger,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { department: "College of Nursing", consent: true },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const res = await fetch("/api/student/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, confirmPassword: undefined, eventId: event?.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        const fields = (json.error?.fields ?? {}) as Record<string, string[]>;
        const names = Object.keys(fields);
        for (const name of names) setError(name as keyof FormValues, { message: fields[name][0] });
        setFormError(json.error?.message ?? "Couldn't create your account. Please try again.");
        if (names[0]) setFocus(names[0] as keyof FormValues);
        else requestAnimationFrame(() => alertRef.current?.focus());
        return;
      }
      setPhase("signing-in");
      const { error } = await createClient().auth.signInWithPassword({ email: String(values.email).trim(), password: String(values.password) });
      if (error) {
        router.push("/student/login?created=1");
        return;
      }
      const reg = json.data.registration as { ok: boolean; referenceCode?: string; message?: string } | null;
      const qs = reg?.ok ? `registered=${encodeURIComponent(reg.referenceCode!)}` : reg ? `regError=${encodeURIComponent(reg.message ?? "")}` : "welcome=1";
      router.replace(`/me?${qs}`);
      router.refresh();
    } catch {
      setFormError("Can't reach the server. Check your connection and try again.");
      requestAnimationFrame(() => alertRef.current?.focus());
    }
  }

  const aria = (name: keyof FormValues, hasHint = false) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] || hasHint ? `${name}-msg` : undefined,
  });
  const busy = isSubmitting || phase === "signing-in";

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
        <Field id="fullName" label="Full name" hint="e.g. Maria Clara Santos" error={errors.fullName?.message}>
          <input id="fullName" {...register("fullName")} {...aria("fullName", true)} autoComplete="name" maxLength={120} className="input bg-[#f3f7f6]" placeholder="First and last name" />
        </Field>
        <Field id="studentId" label="Student ID" hint={`10 digits, no dash — e.g. ${STUDENT_ID_EXAMPLE}`} error={errors.studentId?.message}>
          <input id="studentId" {...register("studentId")} {...aria("studentId", true)} inputMode="numeric" autoComplete="off" maxLength={12} spellCheck={false} className="input font-mono bg-[#f3f7f6]" placeholder={`e.g. ${STUDENT_ID_EXAMPLE}`} />
        </Field>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
          <Field id="section" label="Section" hint="e.g. BSN 2-B" error={errors.section?.message}>
            <input id="section" {...register("section")} {...aria("section", true)} autoCapitalize="characters" maxLength={40} className="input bg-[#f3f7f6]" placeholder="e.g. BSN 2-B" />
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

      <fieldset className="flex flex-col gap-4 pt-4 border-t border-[#eef4f3]">
        <legend className="font-bold text-ink flex items-center gap-2 mb-1">
          <ShieldCheck className="w-[18px] h-[18px] text-brand-600" aria-hidden="true" /> Your account
        </legend>
        <Field id="email" label="Email address" hint="e.g. you@nursing.edu.ph" error={errors.email?.message}>
          <input id="email" type="email" {...register("email")} {...aria("email", true)} inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} className="input bg-[#f3f7f6]" placeholder="you@nursing.edu.ph" />
        </Field>
        <Field id="password" label="Password" hint="At least 8 characters, with a letter and a number" error={errors.password?.message}>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              {...register("password", {
                onChange: () => {
                  if (touchedFields.confirmPassword) void trigger("confirmPassword");
                },
              })}
              {...aria("password", true)}
              autoComplete="new-password"
              maxLength={72}
              className="input bg-[#f3f7f6] pr-14"
            />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide passwords" : "Show passwords"} aria-pressed={show} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#4b6362] hover:bg-slate-100">
              {show ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </Field>
        <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <input id="confirmPassword" type={show ? "text" : "password"} {...register("confirmPassword")} {...aria("confirmPassword")} autoComplete="new-password" maxLength={72} className="input bg-[#f3f7f6]" />
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
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-500/20 rounded-xl px-3 py-2.5 outline-none"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Creating account…</> : phase === "signing-in" ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Opening your dashboard…</> : "Create account"}
      </button>
    </form>
  );
}
