export type Role = "super_admin" | "event_admin" | "scanner_staff" | "student";
export type StaffRole = Exclude<Role, "student">;

export type Permission =
  | "dashboard.view"
  | "scan.perform"
  | "attendance.manual"
  | "participants.view"
  | "participants.manage"
  | "attendance.correct"
  | "credentials.manage"
  | "events.manage"
  | "reports.view"
  | "reports.export"
  | "audit.view"
  | "roles.manage";

const MATRIX: Record<StaffRole, Permission[]> = {
  scanner_staff: ["dashboard.view", "scan.perform", "attendance.manual", "participants.view"],
  event_admin: [
    "dashboard.view",
    "scan.perform",
    "attendance.manual",
    "participants.view",
    "participants.manage",
    "attendance.correct",
    "credentials.manage",
    "events.manage",
    "reports.view",
    "reports.export",
    "audit.view",
  ],
  super_admin: [
    "dashboard.view",
    "scan.perform",
    "attendance.manual",
    "participants.view",
    "participants.manage",
    "attendance.correct",
    "credentials.manage",
    "events.manage",
    "reports.view",
    "reports.export",
    "audit.view",
    "roles.manage",
  ],
};

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return role === "super_admin" || role === "event_admin" || role === "scanner_staff";
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return isStaffRole(role) && MATRIX[role].includes(permission);
}
