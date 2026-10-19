"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { studentSignupSchema } from "@/lib/schemas";

const formSchema = studentSignupSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
type FormValues = z.input<typeof formSchema>;

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
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

export default function SignupForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), mode: "onTouched" });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const res = await fetch("/api/student/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (json.ok) {
        router.push("/student/login?created=1");
        return;
      }
      const fields = (json.error?.fields ?? {}) as Record<string, string[]>;
      for (const [name, msgs] of Object.entries(fields)) setError(name as keyof FormValues, { message: msgs[0] });
      if (json.error?.code === "INVALID_PROOF") {
        setError("referenceCode", { message: "Doesn't match this student ID" });
      }
      if (json.error?.code === "EMAIL_TAKEN") setError("email", { message: "Already in use" });
      setFormError(json.error?.message ?? "Couldn't create your account. Please try again.");
    } catch {
      setFormError("Can't reach the server. Check your connection and try again.");
    }
  }

  const aria = (name: keyof FormValues) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": `${name}-msg`,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Field id="studentId" label="Student ID" hint="The ID you registered with, e.g. 2021001955" error={errors.studentId?.message}>
        <input id="studentId" {...register("studentId")} {...aria("studentId")} inputMode="numeric" autoComplete="off" maxLength={32} className="input font-mono bg-[#f3f7f6]" placeholder="2021001955" />
      </Field>
      <Field id="referenceCode" label="Reference code" hint="Shown after you registered and on your QR pass, e.g. SA-K7QM-4XPD" error={errors.referenceCode?.message}>
        <input id="referenceCode" {...register("referenceCode")} {...aria("referenceCode")} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={12} className="input font-mono uppercase bg-[#f3f7f6]" placeholder="SA-XXXX-XXXX" />
      </Field>
      <Field id="email" label="Email address" error={errors.email?.message}>
        <input id="email" type="email" {...register("email")} {...aria("email")} inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className="input bg-[#f3f7f6]" placeholder="you@nursing.edu.ph" />
      </Field>
      <Field id="password" label="Password" hint="At least 8 characters, with a letter and a number" error={errors.password?.message}>
        <div className="relative">
          <input id="password" type={show ? "text" : "password"} {...register("password")} {...aria("password")} autoComplete="new-password" className="input bg-[#f3f7f6] pr-14" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide passwords" : "Show passwords"} aria-pressed={show} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#4b6362] hover:bg-slate-100">
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </Field>
      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <input id="confirmPassword" type={show ? "text" : "password"} {...register("confirmPassword")} {...aria("confirmPassword")} autoComplete="new-password" className="input bg-[#f3f7f6]" />
      </Field>

      {formError && (
        <div role="alert" className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {formError}
        </div>
      )}

      <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full mt-1">
        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create account"}
      </button>
    </form>
  );
}
