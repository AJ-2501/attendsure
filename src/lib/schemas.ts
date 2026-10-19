import { z } from "zod";

/** Collapse whitespace, trim, and title-case each word (keeps particles like "dela" lowercase-safe). */
export function normalizeName(input: string): string {
  return input
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'’.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function normalizeStudentId(input: string): string {
  return input.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}

export function normalizeSection(input: string): string {
  return input.normalize("NFKC").replace(/\s+/g, " ").trim().toUpperCase();
}

export const requiredFieldsSchema = z.object({
  department: z.boolean().default(true),
  year_level: z.boolean().default(true),
  email: z.boolean().default(false),
});
export type RequiredFields = z.infer<typeof requiredFieldsSchema>;

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Graduate"] as const;

export interface RegistrationRules {
  studentIdPattern: string;
  studentIdHint: string;
  requiredFields: RequiredFields;
  emailDomain?: string | null;
}

/** Base shape used by the client form (rules applied via buildRegistrationSchema). */
export const registrationBaseSchema = z.object({
  eventId: z.string().uuid({ message: "Select an event" }),
  fullName: z.string(),
  studentId: z.string(),
  section: z.string(),
  department: z.string().optional().default(""),
  yearLevel: z.string().optional().default(""),
  email: z.string().optional().default(""),
  consent: z.literal(true, { message: "You must agree to the data privacy notice" }),
});
export type RegistrationInput = z.input<typeof registrationBaseSchema>;

export function safePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch {
    return /^[A-Z0-9-]{4,20}$/;
  }
}

export function buildRegistrationSchema(rules: RegistrationRules) {
  const idRe = safePattern(rules.studentIdPattern);
  const rf = rules.requiredFields;
  return registrationBaseSchema
    .extend({
      fullName: z
        .string()
        .transform(normalizeName)
        .pipe(
          z
            .string()
            .min(3, "Enter your full name")
            .max(120, "Name is too long")
            .regex(/\S\s+\S/, "Enter your first and last name")
            .regex(/^[\p{L}][\p{L}\s.'’-]*$/u, "Name may only contain letters, spaces, periods, hyphens and apostrophes"),
        ),
      studentId: z
        .string()
        .transform(normalizeStudentId)
        .pipe(z.string().min(1, "Student ID is required").max(32).regex(idRe, `Invalid student ID. ${rules.studentIdHint}`)),
      section: z
        .string()
        .transform(normalizeSection)
        .pipe(z.string().min(1, "Section is required").max(40).regex(/^[A-Z0-9][A-Z0-9 \-]*$/, "Use letters, numbers, spaces or hyphens")),
      department: z
        .string()
        .optional()
        .default("")
        .transform((s) => s.replace(/\s+/g, " ").trim())
        .pipe(rf.department ? z.string().min(2, "College/department is required").max(120) : z.string().max(120)),
      yearLevel: z
        .string()
        .optional()
        .default("")
        .pipe(
          rf.year_level
            ? z.enum(YEAR_LEVELS, { message: "Select your year level" })
            : z.union([z.enum(YEAR_LEVELS), z.literal("")]),
        ),
      email: z
        .string()
        .optional()
        .default("")
        .transform((s) => s.trim().toLowerCase())
        .pipe(
          rf.email
            ? z.string().email("Enter a valid school email")
            : z.union([z.string().email("Enter a valid email"), z.literal("")]),
        ),
    })
    .superRefine((v, ctx) => {
      if (rules.emailDomain && v.email && !v.email.endsWith(`@${rules.emailDomain}`)) {
        ctx.addIssue({ code: "custom", path: ["email"], message: `Use your @${rules.emailDomain} school email` });
      }
    });
}
export type RegistrationParsed = z.output<ReturnType<typeof buildRegistrationSchema>>;

export const attendanceActionSchema = z.enum(["time_in", "time_out"]);
export type AttendanceAction = z.infer<typeof attendanceActionSchema>;

export const scanRequestSchema = z.object({
  eventId: z.string().uuid(),
  action: attendanceActionSchema,
  token: z.string().min(1).max(200),
  idempotencyKey: z.string().uuid(),
});

export const manualAttendanceSchema = z.object({
  eventId: z.string().uuid(),
  registrationId: z.string().uuid(),
  action: attendanceActionSchema,
  reason: z.string().trim().min(5, "Provide a reason (min 5 characters)").max(500),
  idempotencyKey: z.string().uuid(),
});

export const lookupSchema = z.object({
  eventId: z.string().uuid(),
  query: z.string().trim().min(3).max(40),
});

export const correctionSchema = z.object({
  registrationId: z.string().uuid(),
  timeIn: z.string().datetime({ offset: true }).nullable(),
  timeOut: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().trim().min(5, "Provide a reason (min 5 characters)").max(500),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(5, "Provide a reason (min 5 characters)").max(500),
});

export const reissueSchema = z.object({
  registrationId: z.string().uuid(),
  action: attendanceActionSchema,
  reason: z.string().trim().min(5).max(500),
});

const dt = z.string().datetime({ offset: true, message: "Invalid date/time" });
export const eventSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().max(4000).default(""),
    venue: z.string().trim().min(2).max(200),
    organizer: z.string().trim().max(160).default(""),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Invalid time zone"),
    startsAt: dt,
    endsAt: dt,
    registrationOpensAt: dt,
    registrationClosesAt: dt,
    timeInOpensAt: dt,
    timeInClosesAt: dt,
    timeOutOpensAt: dt.nullable().default(null),
    timeOutClosesAt: dt.nullable().default(null),
    timeOutQrTtlMinutes: z.coerce.number().int().min(1).max(1440),
    capacity: z.coerce.number().int().min(1).max(100000),
    allowTimeIn: z.boolean().default(true),
    allowTimeOut: z.boolean().default(true),
    requireTimeOut: z.boolean().default(true),
    studentIdPattern: z
      .string()
      .min(2)
      .max(200)
      .refine((p) => {
        try {
          new RegExp(p);
          return true;
        } catch {
          return false;
        }
      }, "Invalid regular expression"),
    studentIdHint: z.string().max(120).default(""),
    requiredFields: requiredFieldsSchema,
    status: z.enum(["draft", "published", "cancelled"]),
  })
  .superRefine((e, ctx) => {
    const t = (s: string) => new Date(s).getTime();
    if (t(e.endsAt) <= t(e.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" });
    if (t(e.registrationClosesAt) <= t(e.registrationOpensAt))
      ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "Must be after registration opens" });
    if (t(e.timeInClosesAt) <= t(e.timeInOpensAt))
      ctx.addIssue({ code: "custom", path: ["timeInClosesAt"], message: "Must be after time-in opens" });
    if (e.timeOutOpensAt && e.timeOutClosesAt && t(e.timeOutClosesAt) <= t(e.timeOutOpensAt))
      ctx.addIssue({ code: "custom", path: ["timeOutClosesAt"], message: "Must be after time-out opens" });
    if (!e.allowTimeIn && !e.allowTimeOut)
      ctx.addIssue({ code: "custom", path: ["allowTimeIn"], message: "Enable at least one attendance action" });
  });
export type EventInput = z.input<typeof eventSchema>;
export type EventParsed = z.output<typeof eventSchema>;

export const participantQuerySchema = z.object({
  eventId: z.string().uuid().optional(),
  q: z.string().trim().max(60).optional(),
  section: z.string().trim().max(40).optional(),
  status: z.enum(["absent", "checked_in", "completed", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  sort: z.enum(["registered_at", "section"]).default("registered_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

export const roleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(["super_admin", "event_admin", "scanner_staff", "student"]),
  reason: z.string().trim().min(5).max(500),
});

/** Student account creation: proves ownership with a reference code from one of their registrations. */
export const studentSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Use at most 72 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  studentId: z
    .string()
    .transform(normalizeStudentId)
    .pipe(z.string().regex(/^[0-9A-Z-]{4,32}$/, "Enter the student ID you registered with")),
  referenceCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^SA-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Reference codes look like SA-XXXX-XXXX"),
});
export type StudentSignupInput = z.input<typeof studentSignupSchema>;
