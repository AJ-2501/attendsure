"use server";
import { redirect } from "next/navigation";
import { requireStudentPage } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reissuePassLink } from "@/lib/services/students";

export async function openPass(formData: FormData) {
  const student = await requireStudentPage();
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!(await checkRateLimit("studentPass", student.profileId, true))) redirect("/me?error=rate");
  const token = await reissuePassLink(student.profileId, registrationId);
  if (!token) redirect("/me?error=pass");
  redirect(`/p/${token}?from=me`);
}
