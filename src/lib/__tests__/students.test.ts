import { describe, it, expect } from "vitest";
import { buildRegistrationSchema, studentSignupSchema } from "@/lib/schemas";
import { formatTimeRange, registrationPhase } from "@/lib/time";

const tenDigit = buildRegistrationSchema({
  studentIdPattern: "^[0-9]{10}$",
  studentIdHint: "Format: 2021001955",
  requiredFields: { department: false, year_level: false, email: false },
});
const base = {
  eventId: "3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c",
  fullName: "Maria Clara Santos",
  section: "BSN 2-B",
  consent: true,
};

describe("10-digit student ID format", () => {
  it("accepts 2021001955", () => {
    expect(tenDigit.safeParse({ ...base, studentId: "2021001955" }).success).toBe(true);
  });
  it("tolerates surrounding spaces", () => {
    expect(tenDigit.safeParse({ ...base, studentId: " 2021 001955 " }).success).toBe(true);
  });
  it.each(["2021-00195", "2021-001955", "202100195", "20210019555", "20210O1955"])("rejects %s", (id) => {
    const r = tenDigit.safeParse({ ...base, studentId: id });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/2021001955/);
  });
});

describe("Student signup schema", () => {
  const valid = { email: "Maria@Nursing.edu.ph ", password: "nurse2024", studentId: "2021001955", referenceCode: "sa-k7qm-4xpd" };

  it("normalizes email and reference code", () => {
    const r = studentSignupSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("maria@nursing.edu.ph");
    expect(r.data?.referenceCode).toBe("SA-K7QM-4XPD");
  });
  it.each([
    ["short password", { password: "abc12" }],
    ["password without a number", { password: "nursingstudent" }],
    ["bad reference code", { referenceCode: "SA-123" }],
    ["invalid email", { email: "not-an-email" }],
  ])("rejects %s", (_label, patch) => {
    expect(studentSignupSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("time helpers", () => {
  const tz = "Asia/Manila";
  it("formats a same-day range as times only", () => {
    expect(formatTimeRange("2026-11-08T00:00:00Z", "2026-11-08T04:00:00Z", tz)).toMatch(/^8:00\s?AM – 12:00\s?PM$/);
  });
  it("includes dates when a range spans days", () => {
    expect(formatTimeRange("2026-10-10T13:08:00Z", "2026-10-20T13:08:00Z", tz)).toMatch(/Oct 10.*Oct 20/);
  });
  it("reports the registration window phase", () => {
    const e = { registration_opens_at: "2026-10-01T00:00:00Z", registration_closes_at: "2026-10-10T00:00:00Z" };
    expect(registrationPhase(e, new Date("2026-09-30T00:00:00Z"))).toBe("before");
    expect(registrationPhase(e, new Date("2026-10-05T00:00:00Z"))).toBe("open");
    expect(registrationPhase(e, new Date("2026-10-10T00:00:00Z"))).toBe("after");
  });
});
