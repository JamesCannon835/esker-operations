import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import type { Role } from "@/lib/roles";
import { ConfirmButton } from "@/components/confirm-button";
import {
  ProfileForm,
  RoleEditor,
  PasswordForm,
  AccessCodeForm,
} from "../user-edit";
import { setActive, deleteUser } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, phone, active, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
  ]);

  if (!profile) notFound();
  const roles = (roleRows ?? []).map((r) => r.role as Role);

  let email = "";
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(id);
    email = data.user?.email ?? "";
  } catch {
    /* service key not set — email box just shows blank */
  }

  return (
    <>
      <Link className="link-back" href="/admin/users">
        ← Users
      </Link>
      <div className="page-head">
        <h1>{profile.full_name}</h1>
        <span className={profile.active ? "ok" : "blocked"}>
          {profile.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="card">
        <h2>Profile</h2>
        <ProfileForm
          userId={id}
          fullName={profile.full_name}
          phone={profile.phone}
          email={email}
        />
        <p className="field-hint" style={{ marginTop: 10 }}>
          Added {fmtDate(profile.created_at)}. The email is what they sign in
          with.
        </p>
      </div>

      <div className="card">
        <h2>Roles</h2>
        <p className="hint">Tick a role to grant it, untick to remove it.</p>
        <RoleEditor userId={id} current={roles} disabled={!profile.active} />
      </div>

      <div className="card">
        <h2>Login / access code</h2>
        <p className="hint">
          Generate a fresh code to hand to the person — it replaces their old
          one straight away.
        </p>
        <AccessCodeForm userId={id} />
        <details style={{ marginTop: 14 }}>
          <summary className="hint" style={{ cursor: "pointer" }}>
            Or set a specific password
          </summary>
          <div style={{ marginTop: 10 }}>
            <PasswordForm userId={id} />
          </div>
        </details>
      </div>

      <div className="card">
        <h2>{profile.active ? "Deactivate" : "Reactivate"}</h2>
        <p className="hint">
          {profile.active
            ? "Blocks their login immediately. Their records stay."
            : "Restores their login. You may need to re-add roles."}
        </p>
        <ConfirmButton
          action={setActive.bind(null, id, !profile.active)}
          label={profile.active ? "Deactivate person" : "Reactivate person"}
          className={profile.active ? "btn danger" : "btn"}
          confirmText={
            profile.active
              ? "Deactivate this person? They won't be able to sign in."
              : undefined
          }
        />
        <div
          style={{
            marginTop: 16,
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
          }}
        >
          <p className="hint">
            Or delete this person entirely — removes their login, profile and
            roles. Only works if they have no activity yet (faults, checks,
            uploads); otherwise deactivate.
          </p>
          <ConfirmButton
            action={deleteUser.bind(null, id)}
            label="Delete permanently"
            className="btn danger"
            confirmText={`Permanently delete ${profile.full_name}? This removes their login and cannot be undone.`}
          />
        </div>
      </div>
    </>
  );
}
