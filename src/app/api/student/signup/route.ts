import { type NextRequest } from "next/server";
import { ok, fail, handle, clientIp } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createStudentAccount } from "@/lib/services/students";

export const runtime = "nodejs";

export const POST = handle("student-signup", async (req: NextRequest) => {
  const allowed = await checkRateLimit("studentSignup", clientIp(req), true);
  if (!allowed) return fail(429, "RATE_LIMITED", "Too many attempts. Please wait 15 minutes and try again.");

  const result = await createStudentAccount(await req.json());
  if (result.ok) return ok({ created: true }, 201);

  switch (result.code) {
    case "VALIDATION_ERROR":
      return fail(422, result.code, "Please check the highlighted fields.", result.fields);
    case "INVALID_PROOF":
      // Deliberately vague: never reveal whether a student ID or code exists.
      return fail(400, result.code, "We couldn't match that student ID and reference code. Check both and try again.");
    case "ALREADY_CLAIMED":
      return fail(409, result.code, "That registration already belongs to an account. Sign in instead.");
    case "EMAIL_TAKEN":
      return fail(409, result.code, "That email is already in use. Sign in or use another email.");
    case "ERROR":
      return fail(500, result.code, "Couldn't create your account. Please try again.");
  }
});
