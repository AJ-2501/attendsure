import { describe, it, expect } from "vitest";
import { sha256Hex, newQrCredential, deriveQrToken, hashScannedToken } from "@/lib/crypto/tokens";

describe("Token utilities", () => {
  it("sha256Hex should be 64-character hex", () => {
    const h = sha256Hex("hello world");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("sha256Hex should be deterministic", () => {
    expect(sha256Hex("test")).toBe(sha256Hex("test"));
  });

  it("newQrCredential produces unique tokens each call", () => {
    const a = newQrCredential();
    const b = newQrCredential();
    expect(a.token).not.toBe(b.token);
    expect(a.id).not.toBe(b.id);
  });

  it("token hash matches what scanner would compute", () => {
    const { id, token, tokenHash } = newQrCredential();
    // derive token the same way participant page would
    const derived = deriveQrToken(id);
    expect(derived).toBe(token);
    // hash matches what process_scan would look up
    const scanned = hashScannedToken(token);
    expect(scanned).toBe(tokenHash);
  });
});
