/**
 * Only allow same-site relative redirects (prevents open redirects via ?next=).
 * Browsers treat "\" like "/" and drop tabs/newlines, so "/\evil.com" or "/\t/evil.com"
 * would leave the site: reject those, then confirm the resolved URL stays on this origin.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  try {
    const base = "https://same-origin.invalid";
    return new URL(next, base).origin === base ? next : null;
  } catch {
    return null;
  }
}
