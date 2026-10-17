/**
 * LEGACY Triple DES field encryption (project requirement).
 *
 * 3DES is deprecated (NIST SP 800-131A Rev.2 disallows it for encryption after 2023).
 * It is isolated behind this module and a versioned envelope so stored values can
 * be migrated to AES-256-GCM ("v2") without schema changes. See docs/ENCRYPTION.md.
 *
 * Construction (envelope v1):
 *   cipher   : des-ede3-cbc (OpenSSL via node:crypto) — 3-key EDE, 24-byte key
 *   IV       : 8 random bytes per encryption (never reused)
 *   padding  : PKCS#7 (OpenSSL default)
 *   integrity: HMAC-SHA256 over "v1|tdes-cbc|iv|ciphertext|context" with a SEPARATE key
 *              (encrypt-then-MAC). CBC is not authenticated on its own.
 *   format   : v1.<iv b64url>.<ct b64url>.<mac b64url>
 *
 * Server-only. Keys are read from env and never logged or returned to clients.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, getCiphers, randomBytes, timingSafeEqual } from "node:crypto";

const ALGO = "des-ede3-cbc";
const VERSION = "v1";

export class CryptoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoConfigError";
  }
}
export class DecryptionError extends Error {
  constructor() {
    super("Unable to decrypt value");
    this.name = "DecryptionError";
  }
}

interface Keys {
  enc: Buffer;
  mac: Buffer;
}
let cached: Keys | null = null;

function decodeKey(name: string, expectedLen: number | "min32"): Buffer {
  const raw = process.env[name];
  if (!raw) throw new CryptoConfigError(`Missing required secret ${name}`);
  const buf = Buffer.from(raw, "base64");
  if (expectedLen === "min32" ? buf.length < 32 : buf.length !== expectedLen) {
    throw new CryptoConfigError(
      `Secret ${name} must be base64 of ${expectedLen === "min32" ? "at least 32" : expectedLen} bytes`,
    );
  }
  return buf;
}

export function loadTdesKeys(): Keys {
  if (cached) return cached;
  if (!getCiphers().includes(ALGO)) {
    throw new CryptoConfigError(
      `Runtime OpenSSL does not provide ${ALGO}. Refusing to fall back to custom cryptography.`,
    );
  }
  const enc = decodeKey("TDES_ENCRYPTION_KEY", 24);
  // Reject degenerate keys where K1==K2 or K2==K3 (collapses to single DES).
  const k1 = enc.subarray(0, 8), k2 = enc.subarray(8, 16), k3 = enc.subarray(16, 24);
  if (k1.equals(k2) || k2.equals(k3) || k1.equals(k3)) {
    throw new CryptoConfigError("TDES_ENCRYPTION_KEY must contain three distinct 8-byte subkeys");
  }
  const mac = decodeKey("TDES_MAC_KEY", "min32");
  cached = { enc, mac };
  return cached;
}

/** For tests only. */
export function __resetKeyCache() {
  cached = null;
}

const b64u = (b: Buffer) => b.toString("base64url");

function mac(key: Buffer, iv: Buffer, ct: Buffer, context: string) {
  return createHmac("sha256", key)
    .update(`${VERSION}|tdes-cbc|`)
    .update(iv)
    .update("|")
    .update(ct)
    .update(`|${context}`)
    .digest();
}

/**
 * Encrypt a UTF-8 string. `context` binds the ciphertext to its column
 * (e.g. "registrations.student_id") so values cannot be swapped between fields.
 */
export function tdesEncrypt(plaintext: string, context: string): string {
  const { enc, mac: macKey } = loadTdesKeys();
  const iv = randomBytes(8);
  const cipher = createCipheriv(ALGO, enc, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = mac(macKey, iv, ct, context);
  return [VERSION, b64u(iv), b64u(ct), b64u(tag)].join(".");
}

export function tdesDecrypt(envelope: string, context: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new DecryptionError();
  const { enc, mac: macKey } = loadTdesKeys();
  const iv = Buffer.from(parts[1], "base64url");
  const ct = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  if (iv.length !== 8 || ct.length === 0 || ct.length % 8 !== 0) throw new DecryptionError();
  const expected = mac(macKey, iv, ct, context);
  if (tag.length !== expected.length || !timingSafeEqual(tag, expected)) throw new DecryptionError();
  try {
    const decipher = createDecipheriv(ALGO, enc, iv);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new DecryptionError();
  }
}

export const FIELD = {
  name: "registrations.participant_name",
  studentId: "registrations.student_id",
  email: "registrations.email",
} as const;
