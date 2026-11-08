/**
 * Staff sign in with a username. Supabase Auth is email-based, so each username maps to an
 * internal address on a reserved, undeliverable domain (RFC 2606 `.invalid`): no mail is ever sent there.
 */
export const STAFF_LOGIN_DOMAIN = "staff.attendsure.invalid";

/** 3–32 characters: lowercase letters, numbers, dots, hyphens, underscores; starts and ends with a letter or number. */
export const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$/;

export function normalizeUsername(input: string): string {
  return input.normalize("NFKC").trim().toLowerCase();
}

export function staffEmailFromUsername(username: string): string {
  return `${normalizeUsername(username)}@${STAFF_LOGIN_DOMAIN}`;
}

/** The username for a staff login address, or null for any other email. */
export function usernameFromStaffEmail(email: string | null | undefined): string | null {
  const suffix = `@${STAFF_LOGIN_DOMAIN}`;
  return email && email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : null;
}

/** One message for every failed staff sign-in, so attempts can't reveal which usernames exist. */
export const INVALID_CREDENTIALS_MESSAGE = "Incorrect username or password.";
