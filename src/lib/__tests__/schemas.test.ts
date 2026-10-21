import { describe, it, expect } from "vitest";
import {
  buildRegistrationSchema,
  claimRegistrationSchema,
  correctionSchema,
  lookupSchema,
  signInSchema,
} from "@/lib/schemas";

const rules = {
  studentIdPattern: "^[0-9]{10}$",
  studentIdHint: "Format: 2020001234",
  requiredFields: { department: true, year_level: true, email: false },
};

const schema = buildRegistrationSchema(rules);

describe("Registration schema", () => {
  const valid = {
    eventId: "3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c",
    fullName: "Juan Dela Cruz",
    studentId: "2020001234",
    section: "BSCS 3-A",
    department: "CCS",
    yearLevel: "3rd Year",
    consent: true,
  };

  it("accepts a valid registration", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid student ID format", () => {
    const r = schema.safeParse({ ...valid, studentId: "INVALID" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/studentId/);
  });

  it("requires full name at least 2 words", () => {
    const r = schema.safeParse({ ...valid, fullName: "Juan" });
    expect(r.success).toBe(false);
  });

  it("requires department when required_fields.department is true", () => {
    const r = schema.safeParse({ ...valid, department: "" });
    expect(r.success).toBe(false);
  });

  it("requires consent", () => {
    const r = schema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });
});

describe("Sign-in schema", () => {
  it("accepts valid email and password", () => {
    const r = signInSchema.safeParse({ email: " student@nursing.edu.ph ", password: "secret" });
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("student@nursing.edu.ph");
  });

  it("rejects empty or invalid email and empty password", () => {
    expect(signInSchema.safeParse({ email: "", password: "secret" }).error?.flatten().fieldErrors.email?.[0]).toBe(
      "Enter your email address.",
    );
    expect(signInSchema.safeParse({ email: "not-an-email", password: "secret" }).error?.flatten().fieldErrors.email?.[0]).toMatch(
      /Enter a valid email/,
    );
    expect(signInSchema.safeParse({ email: "student@nursing.edu.ph", password: "" }).error?.flatten().fieldErrors.password?.[0]).toBe(
      "Enter your password.",
    );
  });
});

describe("Claim, lookup, and correction schemas", () => {
  it("validates claimRegistrationSchema", () => {
    const ok = claimRegistrationSchema.safeParse({ studentId: " 2020 001234 ", referenceCode: "sa-abcd-1234" });
    expect(ok.success).toBe(true);
    expect(ok.data).toEqual({ studentId: "2020001234", referenceCode: "SA-ABCD-1234" });
    expect(claimRegistrationSchema.safeParse({ studentId: "", referenceCode: "bad" }).success).toBe(false);
  });

  it("validates lookupSchema", () => {
    expect(
      lookupSchema.safeParse({ eventId: "3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c", query: "2020001234" }).success,
    ).toBe(true);
    expect(lookupSchema.safeParse({ eventId: "bad-uuid", query: "ab" }).success).toBe(false);
  });

  it("prevents timeOut earlier than timeIn in correctionSchema", () => {
    const base = {
      registrationId: "3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c",
      reason: "Corrected manual scan timestamp",
    };
    expect(
      correctionSchema.safeParse({
        ...base,
        timeIn: "2026-10-20T09:00:00Z",
        timeOut: "2026-10-20T08:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      correctionSchema.safeParse({
        ...base,
        timeIn: "2026-10-20T08:00:00Z",
        timeOut: "2026-10-20T09:00:00Z",
      }).success,
    ).toBe(true);
  });
});
