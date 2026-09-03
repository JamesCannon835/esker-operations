import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, ROLES, hasRole, type Role } from "@/lib/roles";
import { AppHeader } from "@/components/app-header";
import { AccessCheck } from "./access-check";
import { RolePanels } from "./role-panels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("users")
      .select("full_name, active")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (roleRows ?? [])
    .map((r) => r.role as Role)
    .filter((r): r is Role => (ROLES as readonly string[]).includes(r));

  return (
    <>
      <AppHeader roles={roles} />

      <div className="container">
        <div className="card">
          <h2>{profile?.full_name ?? user.email}</h2>
          <p className="hint">
            {user.email}
            {profile && profile.active === false ? " · account inactive" : ""}
          </p>
          <div>
            {roles.length > 0 ? (
              roles.map((r) => (
                <span className="badge role" key={r}>
                  {ROLE_LABELS[r]}
                </span>
              ))
            ) : (
              <span className="badge">no role assigned</span>
            )}
          </div>
        </div>

        {!profile && (
          <div className="card">
            <h2>Account not set up</h2>
            <p className="hint">
              You are signed in, but there is no row for you in{" "}
              <code>public.users</code>. An admin needs to run{" "}
              <code>supabase/seed.sql</code> (see the README) to link your login
              to a profile and role.
            </p>
          </div>
        )}

        {profile && roles.length === 0 && (
          <div className="card">
            <h2>No role assigned</h2>
            <p className="hint">
              Your profile exists but you hold no role in{" "}
              <code>public.user_roles</code>, so you only see your own record.
              An admin can assign one.
            </p>
          </div>
        )}

        <RolePanels userId={user.id} roles={roles} />

        {hasRole(roles, "admin") && <AccessCheck roles={roles} />}
      </div>
    </>
  );
}
