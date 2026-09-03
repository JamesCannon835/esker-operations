import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, isManager, hasRole, type Role } from "@/lib/roles";
import type { User } from "@supabase/supabase-js";

export type SessionUser = {
  user: User;
  roles: Role[];
};

/**
 * Loads the signed-in user and their roles, or redirects to /login.
 * Use at the top of any protected server component / layout.
 */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (roleRows ?? [])
    .map((r) => r.role as Role)
    .filter((r): r is Role => (ROLES as readonly string[]).includes(r));

  return { user, roles };
}

/** Transport manager or admin only. */
export async function requireManager(): Promise<SessionUser> {
  const s = await requireUser();
  if (!isManager(s.roles)) redirect("/dashboard");
  return s;
}

/** Manager, admin, or mechanic — the roles that manage assets & compliance. */
export async function requireStaff(): Promise<SessionUser> {
  const s = await requireUser();
  if (!isManager(s.roles) && !hasRole(s.roles, "mechanic")) redirect("/dashboard");
  return s;
}
