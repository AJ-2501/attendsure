import { describe, it, expect } from "vitest";
import { buildRegistrationSchema, studentSignupSchema } from "@/lib/schemas";
import { formatTimeRange, registrationPhase } from "@/lib/time";

const tenDigit = buildRegistrationSchema({
  studentIdPattern: "^[0-9]{10}$",
  studentIdHint: "Format: 2020001234",
  requiredFields: { department: false, year_level: false, email: false },
});
const base = {
  eventId: "3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c",
  fullName: "Maria Clara Santos",
  section: "BSN 2-B",
  consent: true,
};

describe("10-digit student ID format", () => {
  it("accepts 2020001234", () => {
    expect(tenDigit.safeParse({ ...base, studentId: "2020001234" }).success).toBe(true);
  });
  it("tolerates surrounding spaces", () => {
    expect(tenDigit.safeParse({ ...base, studentId: " 2021 001955 " }).success).toBe(true);
  });
  it.each(["2021-00195", "2021-001955", "202100195", "20200012345", "20210O1955"])("rejects %s", (id) => {
    const r = tenDigit.safeParse({ ...base, studentId: id });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/2020001234/);
  });
});

describe("Student signup schema", () => {
  const valid = { email: "mcsantos.student@ua.edu.ph", password: "nurse2024", studentId: "2020001234", referenceCode: "sa-k7qm-4xpd" };

  it("normalizes email and reference code", () => {
    const r = studentSignupSchema.safeParse({ ...valid, email: "  MCSantos.Student@UA.EDU.PH  " });
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("mcsantos.student@ua.edu.ph");
    expect(r.data?.referenceCode).toBe("SA-K7QM-4XPD");
  });
  it.each([
    ["short password", { password: "abc12" }],
    ["password without a number", { password: "nursingstudent" }],
    ["bad reference code", { referenceCode: "SA-123" }],
    ["invalid email", { email: "not-an-email" }],
    ["non-university email", { email: "maria@nursing.edu.ph" }],
    ["commercial email", { email: "student@gmail.com" }],
    ["missing student subdomain", { email: "mcsantos@ua.edu.ph" }],
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

describe("Student profile sign-up (event-independent)", () => {
  const valid = {
    fullName: "maria  clara santos",
    studentId: "2020001234",
    section: "bsn-1a",
    yearLevel: "2nd Year",
    department: "College of Nursing",
    email: "MCSantos.Student@UA.EDU.PH",
    password: "nurse2024",
    consent: true,
  };

  it("accepts e.g. 2020001234 and normalizes name, section and email", async () => {
    const { studentProfileSchema } = await import("@/lib/schemas");
    const r = studentProfileSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ fullName: "Maria Clara Santos", section: "BSN-1A", email: "mcsantos.student@ua.edu.ph", studentId: "2020001234" });
  });

  it.each([["2020-001234"], [" 2020 001234 "]])("accepts %s by ignoring spaces and dashes", async (id) => {
    const { studentProfileSchema } = await import("@/lib/schemas");
    expect(studentProfileSchema.safeParse({ ...valid, studentId: id }).data?.studentId).toBe("2020001234");
  });

  it.each([
    ["too short", "202000123", /10 digits/],
    ["too long", "20200012345", /10 digits/],
    ["letters", "2020OO1234", /digits only/],
    ["empty", "", /Enter your student ID/],
  ])("rejects a student ID that is %s with a helpful message", async (_l, id, msg) => {
    const { studentProfileSchema } = await import("@/lib/schemas");
    const r = studentProfileSchema.safeParse({ ...valid, studentId: id });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.studentId?.[0]).toMatch(msg);
  });

  it("accepts up to 4th year and rejects beyond 4th year", async () => {
    const { studentProfileSchema } = await import("@/lib/schemas");
    expect(studentProfileSchema.safeParse({ ...valid, yearLevel: "4th Year" }).success).toBe(true);
    expect(studentProfileSchema.safeParse({ ...valid, yearLevel: "5th Year" }).success).toBe(false);
    expect(studentProfileSchema.safeParse({ ...valid, yearLevel: "Graduate" }).success).toBe(false);
  });

  it("requires year level, consent and a first + last name", async () => {
    const { studentProfileSchema } = await import("@/lib/schemas");
    const r = studentProfileSchema.safeParse({ ...valid, yearLevel: "", consent: false, fullName: "Maria" });
    const f = r.error?.flatten().fieldErrors ?? {};
    expect(Object.keys(f).sort()).toEqual(["consent", "fullName", "yearLevel"]);
  });
});
