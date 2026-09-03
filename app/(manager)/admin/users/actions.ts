"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, ROLES, type Role } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { orNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string; ok?: string };

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
  const password = orNull(formData.get("password"));
  const roles = readRoles(formData);

  if (!email) return { error: "Email is required." };
  if (!full_name) return { error: "Full name is required." };
  if (!password || password.length < 8) {
    return { error: "Set a starting password of at least 8 characters." };
  }

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
  redirect(`/admin/users/${uid}`);
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
