import type { Role } from "@/lib/roles";
import { isManager, hasRole } from "@/lib/roles";

export const TASK_BUCKET = "documents";
export const TASK_PREFIX = "actions";
export const TASK_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Who can open Tasks at all — management, admin, mechanics and yard / quarry
 * staff. Drivers do not see tasks.
 */
export function canSeeTasks(roles: Role[]): boolean {
  return (
    isManager(roles) ||
    hasRole(roles, "mechanic") ||
    hasRole(roles, "yard_staff") ||
    hasRole(roles, "plant_operator")
  );
}

/** Managers + mechanics see every task; yard staff see only their own. */
export function canSeeAllTasks(roles: Role[]): boolean {
  return isManager(roles) || hasRole(roles, "mechanic");
}

/** Who can create a task and assign it — management / admin only. */
export function canAssignTasks(roles: Role[]): boolean {
  return isManager(roles);
}

export type TaskAttachment = {
  id: string;
  file_path: string;
  file_name: string | null;
  content_type: string | null;
  uploaded_at: string;
};
