import { describe, it, expect } from "vitest";
import { getQrDataUrl } from "../qr-cache";
import { normalizeReferenceCode, eventSchema } from "../schemas";

describe("QR Cache and Pre-warming", () => {
  it("generates a valid QR data URL and serves from cache on second call", async () => {
    const token = "TEST_TOKEN_1234567890";
    const url1 = await getQrDataUrl(token, { width: 300 });
    expect(url1).toMatch(/^data:image\/png;base64,/);

    const url2 = await getQrDataUrl(token, { width: 300 });
    // Same instance from cache
    expect(url1).toBe(url2);
  });
});

describe("Reference Code Normalization", () => {
  it("normalizes lowercase and whitespace", () => {
    expect(normalizeReferenceCode("sa-abcd-1234")).toBe("SA-ABCD-1234");
    expect(normalizeReferenceCode("  SA 9876 5432  ")).toBe("SA-9876-5432");
    expect(normalizeReferenceCode("abcd-1234")).toBe("SA-ABCD-1234");
  });
});

describe("Event Schema Validations", () => {
  const baseValidEvent = {
    name: "Nursing Clinical Orientation",
    description: "Orientation for 2nd year nursing students",
    venue: "Main Amphitheater",
    organizer: "College of Nursing",
    timezone: "Asia/Manila",
    startsAt: "2026-11-01T08:00:00Z",
    endsAt: "2026-11-01T17:00:00Z",
    registrationOpensAt: "2026-10-25T08:00:00Z",
    registrationClosesAt: "2026-10-31T17:00:00Z",
    timeInOpensAt: "2026-11-01T07:30:00Z",
    timeInClosesAt: "2026-11-01T09:00:00Z",
    timeOutOpensAt: null,
    timeOutClosesAt: null,
    timeOutQrTtlMinutes: 15,
    capacity: 250,
    allowTimeIn: true,
    allowTimeOut: true,
    requireTimeOut: true,
    studentIdPattern: "^[0-9]{10}$",
    studentIdHint: "10 digits",
    requiredFields: { department: true, year_level: true, email: false },
    status: "published" as const,
  };

  it("accepts valid event with null timeout window", () => {
    expect(eventSchema.safeParse(baseValidEvent).success).toBe(true);
  });

  it("requires timeOutClosesAt when timeOutOpensAt is set", () => {
    const r = eventSchema.safeParse({
      ...baseValidEvent,
      timeOutOpensAt: "2026-11-01T15:00:00Z",
      timeOutClosesAt: null,
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/timeOutClosesAt/);
  });

  it("requires timeOutOpensAt when timeOutClosesAt is set", () => {
    const r = eventSchema.safeParse({
      ...baseValidEvent,
      timeOutOpensAt: null,
      timeOutClosesAt: "2026-11-01T18:00:00Z",
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/timeOutOpensAt/);
  });

  it("accepts properly configured time-out window", () => {
    const r = eventSchema.safeParse({
      ...baseValidEvent,
      timeOutOpensAt: "2026-11-01T15:00:00Z",
      timeOutClosesAt: "2026-11-01T18:00:00Z",
    });
    expect(r.success).toBe(true);
  });
});
