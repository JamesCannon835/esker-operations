import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const [{ data: users, error }, { data: roleRows }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, phone, active, created_at")
      .order("full_name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const emailByUser = new Map<string, string>();
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({
      perPage: 1000,
    });
    for (const u of data?.users ?? []) {
      if (u.email) emailByUser.set(u.id, u.email);
    }
  } catch {
    /* service key not set — the email column just shows blanks */
  }

  const rolesByUser = new Map<string, Role[]>();
  for (const r of roleRows ?? []) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role as Role);
    rolesByUser.set(r.user_id, list);
  }

  return (
    <>
      <div className="page-head">
        <h1>Users &amp; roles</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn small ghost" href="/admin/users/import">
            Import list
          </Link>
          <Link className="btn small" href="/admin/users/new">
            + Add person
          </Link>
        </div>
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {!users || users.length === 0 ? (
          <p className="empty">No people yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sign-in email</th>
                <th>Phone</th>
                <th>Roles</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`}>{u.full_name}</Link>
                  </td>
                  <td className="muted">{emailByUser.get(u.id) ?? "—"}</td>
                  <td className="muted">{u.phone ?? "—"}</td>
                  <td>
                    {(rolesByUser.get(u.id) ?? []).length === 0 ? (
                      <span className="muted">none</span>
                    ) : (
                      (rolesByUser.get(u.id) ?? []).map((r) => (
                        <span className="badge" key={r}>
                          {ROLE_LABELS[r]}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    {u.active ? (
                      <span className="ok">Active</span>
                    ) : (
                      <span className="blocked">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="field-hint">
        Deactivating a person blocks their login and removes their access — their
        history stays. Nothing here is ever deleted.
      </p>
    </>
  );
}
