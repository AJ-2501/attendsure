import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, isStaffRole, type Permission, type Role } from "./permissions";

export interface SessionProfile {
  profileId: string;
  authUserId: string;
  email: string | null;
  displayName: string | null;
  role: Role;
}

/**
 * Resolve the current user from the verified Supabase session (getUser() validates the
 * JWT with Supabase Auth) and load the role from the database — never from the client.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("id, role, display_name")
    .eq("auth_user_id", data.user.id)
    .maybeSingle<{ id: string; role: Role; display_name: string | null }>();
  if (!profile) return null;
  return {
    profileId: profile.id,
    authUserId: data.user.id,
    email: data.user.email ?? null,
    displayName: profile.display_name,
    role: profile.role,
  };
});

export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Authentication required" : "You do not have permission to perform this action");
  }
}

/** For route handlers / server actions: throws AuthError. */
export async function requirePermission(permission: Permission): Promise<SessionProfile> {
  const p = await getSessionProfile();
  if (!p) throw new AuthError(401);
  if (!can(p.role, permission)) throw new AuthError(403);
  return p;
}

/** For server-component pages: redirects. */
export async function requirePagePermission(permission: Permission): Promise<SessionProfile> {
  const p = await getSessionProfile();
  if (!p) redirect("/login");
  if (!isStaffRole(p.role)) redirect("/me");
  if (!can(p.role, permission)) redirect("/admin?error=forbidden");
  return p;
}

/** For student pages: signed-in students only; staff are sent to the admin dashboard. */
export async function requireStudentPage(): Promise<SessionProfile> {
  const p = await getSessionProfile();
  if (!p) redirect("/student/login");
  if (isStaffRole(p.role)) redirect("/admin");
  return p;
}
