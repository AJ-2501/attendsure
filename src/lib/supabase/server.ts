import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, serverEnv } from "@/lib/env";

/** Cookie-bound client acting as the signed-in user (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component; middleware refreshes the session
        }
      },
    },
  });
}

// No generated Database types: rows are untyped and narrowed at call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = SupabaseClient<any, "public", "public", any>;

let admin: UntypedClient | null = null;
/**
 * Service-role client. Bypasses RLS — ONLY call after server-side authorization
 * (requireStaff) or for tightly scoped public operations (registration RPC).
 */
export function createAdminClient(): UntypedClient {
  if (!admin) {
    admin = createSupabaseClient(env.supabaseUrl, serverEnv().serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as UntypedClient;
  }
  return admin;
}
