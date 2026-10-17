import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";
import { CryptoConfigError } from "@/lib/crypto/tdes";
import { log } from "@/lib/logger";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; fields?: Record<string, string[]> } };

export function ok<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function fail(status: number, code: string, message: string, fields?: Record<string, string[]>) {
  return NextResponse.json<ApiFailure>(
    { ok: false, error: { code, message, ...(fields ? { fields } : {}) } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Wrap a handler with uniform, non-leaky error handling. */
export function handle<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) return fail(err.status, err.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", err.message);
      if (err instanceof ZodError) {
        return fail(422, "VALIDATION_ERROR", "Please check the highlighted fields.", err.flatten().fieldErrors as Record<string, string[]>);
      }
      if (err instanceof SyntaxError) return fail(400, "BAD_REQUEST", "Malformed request body.");
      if (err instanceof CryptoConfigError) {
        log.error("crypto_config_error", { route: name, message: err.message });
        return fail(503, "SERVICE_MISCONFIGURED", "The service is temporarily unavailable.");
      }
      log.error("unhandled_error", { route: name, error: err instanceof Error ? err.name : "unknown" });
      return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  };
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
