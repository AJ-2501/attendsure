/**
 * Structured JSON logger. Callers must never pass plaintext PII, tokens, or keys.
 * A defensive redactor strips known-sensitive keys anyway.
 */
const SENSITIVE = /(name|student_?id|email|token|key|secret|password|authorization|cookie)/i;

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) out[k] = SENSITIVE.test(k) && k !== "route" ? "[redacted]" : v;
  return out;
}

function emit(level: "info" | "warn" | "error", event: string, meta: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...redact(meta) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (e: string, m?: Record<string, unknown>) => emit("info", e, m),
  warn: (e: string, m?: Record<string, unknown>) => emit("warn", e, m),
  error: (e: string, m?: Record<string, unknown>) => emit("error", e, m),
};
