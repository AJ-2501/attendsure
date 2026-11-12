import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isStaffRole, type Role } from "@/lib/auth/permissions";
import { openPendingSignup, PENDING_SIGNUP_COOKIE } from "@/lib/auth/pending-signup";
import { STUDENT_EMAIL_REGEX } from "@/lib/schemas";
import { registerFromProfile, saveStudentDetails } from "@/lib/services/students";
import { log } from "@/lib/logger";
import { safeNext } from "@/lib/safe-next";

export const runtime = "nodejs";

/**
 * Google OAuth return point (students only). Exchanges the code for a session, enforces the
 * school-email rule server-side (Google's `hd` hint can be bypassed), keeps staff out, then saves
 * the details the student filled in before leaving and registers them for the event they came from.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const from = url.searchParams.get("from") === "signup" ? "signup" : "login";
  const next = safeNext(url.searchParams.get("next"));
  const cookieStore = await cookies();
  const pending = openPendingSignup(cookieStore.get(PENDING_SIGNUP_COOKIE)?.value);

  // Errors go back to the page the student started on; a pending sign-up keeps its details (prefilled from the cookie).
  const back = (error: string) => {
    const qs = new URLSearchParams({ error });
    if (from === "signup" && pending?.eventId) qs.set("event", pending.eventId);
    if (from === "login" && next) qs.set("next", next);
    return NextResponse.redirect(new URL(`/student/${from}?${qs}`, request.url));
  };

  // Google returns ?error=access_denied when the student cancels the consent screen.
  const code = url.searchParams.get("code");
  if (!code) return back(url.searchParams.get("error") === "access_denied" ? "cancelled" : "oauth");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    log.warn("oauth_exchange_failed", { message: error?.message });
    return back("oauth");
  }
  const user = data.user;
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, role, student_id_digest, full_name_encrypted, student_id_encrypted")
    .eq("auth_user_id", user.id)
    .maybeSingle<{ id: string; role: Role; student_id_digest: string | null; full_name_encrypted: string | null; student_id_encrypted: string | null }>();

  if (!profile || isStaffRole(profile.role)) {
    await supabase.auth.signOut();
    return back("not_student");
  }

  // Reject without leaving a stray account behind: a Google-only account this very sign-in just created is removed.
  const reject = async (error: string) => {
    await supabase.auth.signOut();
    const googleOnly = (user.identities ?? []).every((i) => i.provider === "google");
    const fresh = Date.now() - Date.parse(user.created_at) < 10 * 60_000;
    if (googleOnly && fresh && !profile.student_id_digest && !profile.full_name_encrypted) {
      await db.auth.admin.deleteUser(user.id).catch(() => undefined);
    }
    return back(error);
  };

  if (!STUDENT_EMAIL_REGEX.test(user.email ?? "")) return reject("domain");

  // Sign-in is for registered students only: no saved details, no linked registrations and no
  // details waiting from the register form means this Google account never registered.
  const registered = Boolean(profile.full_name_encrypted && profile.student_id_encrypted) || Boolean(profile.student_id_digest);
  if (!registered && !pending) return reject("not_registered");

  const email = user.email!.toLowerCase();
  // Read from the row, not getStudentProfile(): that is request-cached and would hide the save below from registerFromProfile.
  let hasDetails = Boolean(profile.full_name_encrypted && profile.student_id_encrypted);
  let isNew = false;
  // Existing accounts keep their saved details (editable on /me); new ones get what was just filled in.
  if (!hasDetails && pending) hasDetails = isNew = await saveStudentDetails(profile.id, pending.details);
  cookieStore.delete(PENDING_SIGNUP_COOKIE);

  if (pending?.eventId && hasDetails) {
    const reg = await registerFromProfile(profile.id, email, pending.eventId);
    const qs = reg.ok ? `registered=${encodeURIComponent(reg.referenceCode)}` : `regError=${encodeURIComponent(reg.message)}`;
    return NextResponse.redirect(new URL(`/me?${qs}`, request.url));
  }
  // No saved details yet (signed in without filling the form): /me opens the details form.
  const dest = next ?? (isNew ? "/me?welcome=1" : "/me");
  return NextResponse.redirect(new URL(dest, request.url));
}
