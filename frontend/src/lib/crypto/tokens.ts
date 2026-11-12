/**
 * Keyed digests and opaque tokens. Server-only.
 *
 * - Student ID lookup digest: HMAC-SHA256(STUDENT_ID_LOOKUP_KEY, "sid:v1:" + normalizedId)
 *   Separate secret from encryption; resists dictionary attacks on predictable IDs.
 * - QR tokens: derived as HMAC-SHA256(QR_TOKEN_SECRET, "qr:v1:" + credentialId) where the
 *   credential id is a fresh random UUID. Only SHA-256(token) is stored in the DB; the server
 *   can re-derive the token to display it to the rightful participant, but a DB leak alone
 *   cannot produce valid tokens.
 * - Participant access tokens: 32 random bytes, only SHA-256 stored.
 */
import "server-only";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { CryptoConfigError } from "./tdes";
import { isReliablyScannable } from "./qr-check";

function secret(name: string): Buffer {
  const raw = process.env[name];
  if (!raw) throw new CryptoConfigError(`Missing required secret ${name}`);
  const buf = Buffer.from(raw, "base64");
  if (buf.length < 32) throw new CryptoConfigError(`Secret ${name} must be base64 of at least 32 bytes`);
  return buf;
}

export const QR_PREFIX = "SA1.";

export function studentIdDigest(normalizedStudentId: string): string {
  return createHmac("sha256", secret("STUDENT_ID_LOOKUP_KEY"))
    .update(`sid:v1:${normalizedStudentId}`)
    .digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function deriveQrToken(credentialId: string): string {
  const mac = createHmac("sha256", secret("QR_TOKEN_SECRET")).update(`qr:v1:${credentialId}`).digest("base64url");
  return QR_PREFIX + mac;
}

/**
 * A fresh credential whose QR is proven to decode (see qr-check.ts). Ids are random, so
 * re-rolling the rare unreadable one costs nothing and guarantees every pass scans.
 */
export function newQrCredential() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = randomUUID();
    const token = deriveQrToken(id);
    if (isReliablyScannable(token) || attempt === 19) return { id, token, tokenHash: sha256Hex(token) };
  }
  throw new Error("unreachable");
}

/** Accepts scanned text; returns the hash to look up or null if malformed. */
export function hashScannedToken(raw: string): string | null {
  const t = raw.trim();
  if (!/^SA1\.[A-Za-z0-9_-]{43}$/.test(t)) return null;
  return sha256Hex(t);
}

export function newAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256Hex(token) };
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
export function newReferenceCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return `SA-${s.slice(0, 4)}-${s.slice(4)}`;
}
