import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

export interface RateLimitRule {
  windowSeconds: number;
  max: number;
}

export const RATE_LIMITS = {
  register: { windowSeconds: 600, max: 10 }, // per IP
  participantView: { windowSeconds: 60, max: 60 }, // per IP
  timeOutIssue: { windowSeconds: 60, max: 6 }, // per registration
  scan: { windowSeconds: 60, max: 120 }, // per staff member
  lookup: { windowSeconds: 60, max: 30 }, // per staff member
} satisfies Record<string, RateLimitRule>;

export type Hit = (key: string, rule: RateLimitRule) => Promise<boolean>;

/**
 * Postgres-backed fixed window limiter (works across serverless instances).
 * Fails OPEN on DB errors only for staff routes; public routes pass failClosed=true.
 */
export const postgresHit =
  (failClosed: boolean): Hit =>
  async (key, rule) => {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_window_seconds: rule.windowSeconds,
      p_max: rule.max,
    } as never);
    if (error) {
      log.warn("rate_limit_unavailable", { bucket: key.split(":")[0] });
      return !failClosed;
    }
    return data === true;
  };

export async function checkRateLimit(bucket: keyof typeof RATE_LIMITS, id: string, failClosed = true, hit: Hit = postgresHit(failClosed)) {
  return hit(`${bucket}:${id}`, RATE_LIMITS[bucket]);
}
