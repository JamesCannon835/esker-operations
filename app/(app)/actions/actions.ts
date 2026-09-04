"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { orNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string; ok?: boolean };

async function requireWorkshop() {
  const { user, roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  return { user, roles };
}

function touch(id: string) {
  revalidatePath("/actions");
  revalidatePath(`/actions/${id}`);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function completeAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireWorkshop();
  const supabase = await createClient();
  const { error } = await supabase
    .from("actions")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      completion_note: orNull(formData.get("completion_note")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  touch(id);
  return { ok: true };
}

/** Quick "done" with no note — for the list view. */
export async function markActionDone(id: string) {
  const { user } = await requireWorkshop();
  const supabase = await createClient();
  await supabase
    .from("actions")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  touch(id);
}

export async function reopenAction(id: string) {
  await requireWorkshop();
  const supabase = await createClient();
  await supabase
    .from("actions")
    .update({
      status: "open",
      completed_at: null,
      completed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  touch(id);
}

export async function updateAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireWorkshop();
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["priority", "assigned_to", "due_date", "status", "detail"]) {
    if (formData.has(k)) patch[k] = orNull(formData.get(k));
  }
  const { error } = await supabase.from("actions").update(patch).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  touch(id);
  return { ok: true };
}
