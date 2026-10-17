import { tdesEncrypt, tdesDecrypt, FIELD } from "@/lib/crypto/tdes";
import { describe, it, expect } from "vitest";

// These tests use the actual env variables when present, or generate test keys.
// They never expose real production keys.

describe("3DES encrypt / decrypt roundtrip", () => {
  it("should encrypt and decrypt a name field", () => {
    const plaintext = "Juan Dela Cruz";
    const ct = tdesEncrypt(plaintext, FIELD.name);
    expect(ct).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    const rt = tdesDecrypt(ct, FIELD.name);
    expect(rt).toBe(plaintext);
  });

  it("should produce different ciphertexts for the same plaintext", () => {
    const ct1 = tdesEncrypt("abc", FIELD.name);
    const ct2 = tdesEncrypt("abc", FIELD.name);
    expect(ct1).not.toBe(ct2); // random IV each time
  });

  it("should reject a tampered ciphertext (MAC mismatch)", () => {
    const ct = tdesEncrypt("hello", FIELD.name);
    const tampered = ct.slice(0, -4) + "XXXX";
    expect(() => tdesDecrypt(tampered, FIELD.name)).toThrow();
  });

  it("should reject plaintext longer than 2048 chars", () => {
    expect(() => tdesEncrypt("x".repeat(2049), FIELD.name)).toThrow("Plaintext too long");
  });
});
