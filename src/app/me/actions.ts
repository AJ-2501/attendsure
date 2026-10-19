"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStudentPage } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { claimRegistration, issueTimeOutPass, reissuePassLink } from "@/lib/services/students";
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

export type ClaimState = { ok: boolean; message: string } | null;

export async function claimAction(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const student = await requireStudentPage();
  if (!(await checkRateLimit("studentSignup", student.profileId, true))) return { ok: false, message: message("RATE_LIMITED") };
  const studentId = String(formData.get("studentId") ?? "");
  const referenceCode = String(formData.get("referenceCode") ?? "");
  if (!studentId.trim() || !/^SA-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(referenceCode.trim())) {
    return { ok: false, message: "Enter your student ID and a reference code like SA-XXXX-XXXX." };
  }
  const r = await claimRegistration(student.profileId, studentId, referenceCode);
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
