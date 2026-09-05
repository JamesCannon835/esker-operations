import type { Role } from "@/lib/roles";
import { isManager, hasRole } from "@/lib/roles";

export const TASK_BUCKET = "documents";
export const TASK_PREFIX = "actions";
export const TASK_MAX_BYTES = 20 * 1024 * 1024;

/** Managers + mechanics see every task; everyone else sees only their own. */
export function canSeeAllTasks(roles: Role[]): boolean {
  return isManager(roles) || hasRole(roles, "mechanic");
}

/** Who can create a task and assign it. */
export function canAssignTasks(roles: Role[]): boolean {
  return isManager(roles) || hasRole(roles, "mechanic");
}

export type TaskAttachment = {
  id: string;
  file_path: string;
  file_name: string | null;
  content_type: string | null;
  uploaded_at: string;
};
