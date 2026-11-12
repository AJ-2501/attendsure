import { STUDENT_EMAIL_EXAMPLE } from "@/lib/schemas";

/** Messages for `?error=` codes set by /auth/callback. Shared by the student sign-in and register pages. */
export const GOOGLE_AUTH_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Try again when you're ready.",
  domain: `Use your UA student Google account (e.g. ${STUDENT_EMAIL_EXAMPLE}). Personal Gmail accounts can't be used.`,
  not_student: "This account can't be used for student sign-in.",
  oauth: "Couldn't sign you in with Google. Please try again.",
};

export function googleAuthError(code: string | undefined | null): string | null {
  return code ? (GOOGLE_AUTH_ERRORS[code] ?? GOOGLE_AUTH_ERRORS.oauth) : null;
}
