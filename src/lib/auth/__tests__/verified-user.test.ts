import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readVerifiedUser, signVerifiedUser } from "../verified-user";

const user = { id: "6f1c1c7e-1d0e-4c55-9a43-6f0c2a0b9e11", email: "staff@staff.attendsure.invalid" };

describe("verified-user header", () => {
  beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("round-trips a signed user", () => {
    expect(readVerifiedUser(signVerifiedUser(user))).toEqual(user);
  });

  it("rejects a forged or tampered value", () => {
    const signed = signVerifiedUser(user)!;
    const [, mac] = signed.split(".");
    const forged = Buffer.from(JSON.stringify({ id: "someone-else", email: null, iat: Date.now() })).toString("base64url");
    expect(readVerifiedUser(`${forged}.${mac}`)).toBeNull();
    expect(readVerifiedUser(`${signed}x`)).toBeNull();
    expect(readVerifiedUser("garbage")).toBeNull();
    expect(readVerifiedUser(null)).toBeNull();
  });

  it("rejects a value signed with a different key", () => {
    const signed = signVerifiedUser(user);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "another-key");
    expect(readVerifiedUser(signed)).toBeNull();
  });

  it("expires after a minute", () => {
    vi.useFakeTimers();
    const signed = signVerifiedUser(user);
    vi.advanceTimersByTime(61_000);
    expect(readVerifiedUser(signed)).toBeNull();
  });
});
