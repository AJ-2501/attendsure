"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStudentPage } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { claimRegistrationSchema } from "@/lib/schemas";
import { claimRegistration, issueTimeOutPass, registerFromProfile, reissuePassLink, updateStudentProfile } from "@/lib/services/students";
import { message } from "@/lib/messages";

export async function openPass(formData: FormData) {
  const student = await requireStudentPage();
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!(await checkRateLimit("studentPass", student.profileId, true))) redirect("/me?error=rate");
  const token = await reissuePassLink(student.profileId, registrationId);
  if (!token) redirect("/me?error=pass");
  redirect(`/p/${token}?from=me`);
}

export type TimeOutPassResult = { ok: true; token: string; expiresAt: string } | { ok: false; error: string };

export async function requestTimeOutPass(registrationId: string): Promise<TimeOutPassResult> {
  const student = await requireStudentPage();
  if (!(await checkRateLimit("timeOutIssue", student.profileId, true))) return { ok: false, error: message("RATE_LIMITED") };
  const r = await issueTimeOutPass(student.profileId, registrationId);
  if (!r.ok || !("token" in r) || !r.token || !r.expiresAt) return { ok: false, error: message(r.code) };
  return { ok: true, token: r.token, expiresAt: r.expiresAt };
}

export type ClaimState = { ok: boolean; message?: string; fields?: Record<string, string[]> } | null;

export async function claimAction(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const student = await requireStudentPage();
  if (!(await checkRateLimit("studentSignup", student.profileId, true))) return { ok: false, message: message("RATE_LIMITED") };
  const parsed = claimRegistrationSchema.safeParse({
    studentId: String(formData.get("studentId") ?? ""),
    referenceCode: String(formData.get("referenceCode") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      message: "Please check the highlighted fields.",
    };
  }
  const r = await claimRegistration(student.profileId, parsed.data.studentId, parsed.data.referenceCode);
  if (!r.ok) {
    return {
      ok: false,
      message: {
        INVALID_PROOF: "That student ID and reference code don't match a registration.",
        ALREADY_CLAIMED: "That registration already belongs to another account.",
        OTHER_STUDENT: "That registration is for a different student ID than your account.",
      }[r.code],
    };
  }
  revalidatePath("/me");
  return { ok: true, message: "Registration added to your dashboard." };
}

/** One tap: register for an event with the saved profile, then show the new QR pass. */
export async function quickRegisterAction(formData: FormData) {
  const student = await requireStudentPage();
  const eventId = String(formData.get("eventId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) redirect("/me?regError=" + encodeURIComponent("That event couldn't be found."));
  if (!(await checkRateLimit("register", `student:${student.profileId}`, true))) {
    redirect("/me?regError=" + encodeURIComponent(message("RATE_LIMITED")));
  }
  const r = await registerFromProfile(student.profileId, student.email, eventId);
  revalidatePath("/me");
  if (r.ok) redirect(`/me?registered=${encodeURIComponent(r.referenceCode)}`);
  redirect(`/me?regError=${encodeURIComponent(r.message)}${r.needsProfile ? "#my-details" : ""}`);
}

export type ProfileState = { ok: boolean; message?: string; fields?: Record<string, string[]> } | null;

export async function saveProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const student = await requireStudentPage();
  const r = await updateStudentProfile(student.profileId, {
    fullName: String(formData.get("fullName") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    section: String(formData.get("section") ?? ""),
    yearLevel: String(formData.get("yearLevel") ?? ""),
    department: String(formData.get("department") ?? ""),
  });
  if (!r.ok) return { ok: false, fields: r.fields, message: r.fields.form?.[0] ?? "Please fix the highlighted fields." };
  revalidatePath("/me");
  return { ok: true, message: "Details saved." };
}
