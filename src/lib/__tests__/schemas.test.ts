import { describe, it, expect } from "vitest";
import { buildRegistrationSchema } from "@/lib/schemas";

const rules = {
  studentIdPattern: "^[0-9]{4}-[0-9]{5}$",
  studentIdHint: "Format: 2024-12345",
  requiredFields: { department: true, year_level: true, email: false },
};

const schema = buildRegistrationSchema(rules);

describe("Registration schema", () => {
  const valid = {
    eventId: "3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c",
    fullName: "Juan Dela Cruz",
    studentId: "2024-12345",
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
