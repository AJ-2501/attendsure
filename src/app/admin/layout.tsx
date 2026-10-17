import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!isStaffRole(profile.role)) redirect("/login?error=not_staff");

  return (
    <AdminShell
      displayName={profile.displayName}
      email={profile.email}
      role={profile.role}
    >
      {children}
    </AdminShell>
  );
}
