import { beforeEach, describe, expect, it, vi } from "vitest";

const registerParticipant = vi.fn();
const getSessionProfile = vi.fn();

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/auth/session", () => ({ getSessionProfile, AuthError: class extends Error {} }));
vi.mock("@/lib/services/registrations", () => ({ registerParticipant }));
vi.mock("@/lib/services/students", () => ({ getProfileDigest: vi.fn(), linkRegistration: vi.fn(), getStudentPrefill: vi.fn() }));
vi.mock("@/lib/services/events", () => ({ listPublishedEvents: vi.fn(async () => []) }));

const { POST } = await import("@/app/api/register/route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/register", { method: "POST", body: JSON.stringify(body) }) as never);

describe("POST /api/register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses signed-out callers and never creates an account or registration", async () => {
    getSessionProfile.mockResolvedValue(null);
    const res = await post({ eventId: crypto.randomUUID(), account: { email: "victim.student@ua.edu.ph", password: "Password123" } });
    expect(res.status).toBe(401);
    expect(registerParticipant).not.toHaveBeenCalled();
  });

  it("lets signed-in staff register a walk-in", async () => {
    getSessionProfile.mockResolvedValue({ profileId: "p1", role: "event_admin", email: null });
    registerParticipant.mockResolvedValue({
      ok: true, registrationId: "r1", studentIdDigest: "d", fullName: "Juan Dela Cruz", referenceCode: "SA-ABCD-EFGH", accessToken: "t", eventName: "E",
    });
    const res = await post({ eventId: crypto.randomUUID() });
    expect(res.status).toBe(201);
    expect(registerParticipant).toHaveBeenCalledOnce();
  });
});
