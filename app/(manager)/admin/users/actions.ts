"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, ROLES, type Role } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { orNull, friendlyDbError } from "@/lib/assets";
import { generateAccessCode } from "@/lib/access-code";
import { looksLikeEmail } from "@/lib/import-parse";

export type FormState = { error?: string; ok?: string };

export type ImportRow = { name: string; email: string; phone?: string };
export type ImportResult = {
  name: string;
  email: string;
  code?: string;
  status: "created" | "skipped" | "error";
  detail?: string;
};
export type ImportState = { error?: string; results?: ImportResult[] };

async function requireAdmin() {
  const { user, roles } = await requireUser();
  if (!hasRole(roles, "admin")) redirect("/dashboard");
  return user;
}

function readRoles(formData: FormData): Role[] {
  return ROLES.filter((r) => formData.get(`role_${r}`) === "on");
}

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const email = orNull(formData.get("email"))?.toLowerCase();
  const full_name = orNull(formData.get("full_name"));
  const phone = orNull(formData.get("phone"));
  const typed = orNull(formData.get("password"));
  const roles = readRoles(formData);

  if (!email) return { error: "Email is required." };
  if (!full_name) return { error: "Full name is required." };
  if (typed && typed.length < 8) {
    return { error: "A typed password must be at least 8 characters." };
  }

  // Blank password field -> generate an access code to hand to the person.
  const generated = !typed;
  const password = typed ?? generateAccessCode();

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (authErr || !created.user) {
    return { error: authErr?.message ?? "Could not create the login." };
  }

  const uid = created.user.id;

  const { error: profErr } = await admin
    .from("users")
    .insert({ id: uid, full_name, phone });
  if (profErr) {
    await admin.auth.admin.deleteUser(uid);
    return { error: friendlyDbError(profErr.message) };
  }

  if (roles.length) {
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert(roles.map((role) => ({ user_id: uid, role })));
    if (roleErr) return { error: friendlyDbError(roleErr.message) };
  }

  revalidatePath("/admin/users");
  if (generated) {
    return {
      ok: `${full_name} created. Access code: ${password} — write it down now, it won't be shown again. Then open their page to set roles.`,
    };
  }
  redirect(`/admin/users/${uid}`);
}

export async function regenerateAccessCode(
  id: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();
  const code = generateAccessCode();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: code,
  });
  if (error) return { error: error.message };
  return { ok: `New access code: ${code} — give it to the person.` };
}

export async function importPeople(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const role = (orNull(formData.get("role")) ?? "") as Role;
  const rawRole = ROLES.includes(role) ? role : null;

  let rows: ImportRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Could not read the pasted rows." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "Nothing to import." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const results: ImportResult[] = [];
  for (const row of rows) {
    const name = (row.name ?? "").trim();
    const email = (row.email ?? "").trim().toLowerCase();
    if (!name || !looksLikeEmail(email)) {
      results.push({
        name,
        email,
        status: "error",
        detail: "missing name or valid email",
      });
      continue;
    }

    const code = generateAccessCode();
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: code,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (authErr || !created.user) {
      results.push({
        name,
        email,
        status: /already|registered|exists/i.test(authErr?.message ?? "")
          ? "skipped"
          : "error",
        detail: authErr?.message,
      });
      continue;
    }

    const uid = created.user.id;
    const { error: profErr } = await admin
      .from("users")
      .insert({ id: uid, full_name: name, phone: row.phone?.trim() || null });
    if (profErr) {
      await admin.auth.admin.deleteUser(uid);
      results.push({ name, email, status: "error", detail: profErr.message });
      continue;
    }
    if (rawRole) {
      await admin.from("user_roles").insert({ user_id: uid, role: rawRole });
    }
    results.push({ name, email, code, status: "created" });
  }

  revalidatePath("/admin/users");
  return { results };
}

export async function updateProfile(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const full_name = orNull(formData.get("full_name"));
  const phone = orNull(formData.get("phone"));
  if (!full_name) return { error: "Full name is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ full_name, phone })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  return { ok: "Saved." };
}

export async function setActive(id: string, active: boolean) {
  await requireAdmin();
  const admin = createAdminClient();

  await admin.from("users").update({ active }).eq("id", id);
  // Also block / unblock the login itself.
  await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  });

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Refuse if the person has activity that would be orphaned.
  const checks = await Promise.all([
    admin.from("faults").select("id", { count: "exact", head: true }).or(`reported_by.eq.${id},assigned_mechanic_id.eq.${id},closed_by.eq.${id}`),
    admin.from("inspections").select("id", { count: "exact", head: true }).eq("completed_by", id),
    admin.from("labour_entries").select("id", { count: "exact", head: true }).eq("mechanic_id", id),
    admin.from("services").select("id", { count: "exact", head: true }).eq("performed_by", id),
    admin.from("documents").select("id", { count: "exact", head: true }).eq("uploaded_by", id),
  ]);
  const activity = checks.reduce((n, r) => n + (r.count ?? 0), 0);
  if (activity > 0) {
    throw new Error(
      "This person has activity in the system (faults, checks, services or uploads). Use Deactivate instead — it blocks their login and keeps the records.",
    );
  }

  // Clear harmless current-assignment pointers so the delete isn't blocked.
  await admin.from("vehicles").update({ assigned_driver_id: null }).eq("assigned_driver_id", id);
  await admin.from("plant").update({ assigned_operator_id: null }).eq("assigned_operator_id", id);
  await admin.from("training_records").update({ created_by: null }).eq("created_by", id);

  // Cascades public.users -> user_roles and training_records(user_id).
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    throw new Error(
      "Could not delete this person — they have linked records. Use Deactivate instead.",
    );
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function toggleRole(id: string, role: Role, add: boolean) {
  await requireAdmin();
  const admin = createAdminClient();

  if (add) {
    await admin
      .from("user_roles")
      .upsert({ user_id: id, role }, { onConflict: "user_id,role" });
  } else {
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", id)
      .eq("role", role);
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
}

export async function resetPassword(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const password = orNull(formData.get("password"));
  if (!password || password.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { error: error.message };

  return { ok: "Password updated — give it to the user." };
}
