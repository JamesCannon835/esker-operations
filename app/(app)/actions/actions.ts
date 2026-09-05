"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { orNull, friendlyDbError } from "@/lib/assets";
import { canAssignTasks } from "@/lib/tasks";

export type FormState = { error?: string; ok?: boolean };

async function requireWorkshop() {
  const { user, roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  return { user, roles };
}

/** Workshop, or the person the task is assigned to. */
async function requireCanTouch(id: string) {
  const { user, roles } = await requireUser();
  if (hasRole(roles, "mechanic") || isManager(roles)) return { user, roles };
  const supabase = await createClient();
  const { data } = await supabase
    .from("actions")
    .select("assigned_to")
    .eq("id", id)
    .maybeSingle();
  if (data?.assigned_to !== user.id) redirect("/dashboard");
  return { user, roles };
}

function touch(id?: string) {
  revalidatePath("/actions");
  if (id) revalidatePath(`/actions/${id}`);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

// ---- create a task -------------------------------------------------
export async function createTask(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, roles } = await requireUser();
  if (!canAssignTasks(roles)) redirect("/dashboard");
  const supabase = await createClient();

  const title = orNull(formData.get("title"));
  if (!title) return { error: "Give the task a short description." };

  const priorityRaw = String(formData.get("priority") ?? "normal");
  const priority = ["critical", "high", "normal", "low"].includes(priorityRaw)
    ? priorityRaw
    : "normal";

  const { data: task, error } = await supabase
    .from("actions")
    .insert({
      entity_type: "task",
      entity_id: user.id, // no linked record — point at the raiser
      source: "manual",
      title,
      detail: orNull(formData.get("detail")),
      priority,
      assigned_to: orNull(formData.get("assigned_to")),
      raised_by: user.id,
      due_date: orNull(formData.get("due_date")),
      status: "open",
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };

  // Attach any photos the browser already uploaded.
  const paths = formData.getAll("photo_path").map(String).filter(Boolean);
  const names = formData.getAll("photo_name").map(String);
  const typesArr = formData.getAll("photo_type").map(String);
  if (paths.length) {
    await supabase.from("action_attachments").insert(
      paths.map((p, i) => ({
        action_id: task.id,
        file_path: p,
        file_name: names[i] || null,
        content_type: typesArr[i] || null,
        uploaded_by: user.id,
      })),
    );
  }

  touch(task.id);
  redirect(`/actions/${task.id}`);
}

export async function registerTaskAttachment(
  actionId: string,
  file: { path: string; name: string; type: string | null },
) {
  const { user } = await requireCanTouch(actionId);
  const supabase = await createClient();
  await supabase.from("action_attachments").insert({
    action_id: actionId,
    file_path: file.path,
    file_name: file.name,
    content_type: file.type,
    uploaded_by: user.id,
  });
  touch(actionId);
}

export async function deleteTaskAttachment(id: string, actionId: string) {
  const { user, roles } = await requireUser();
  const supabase = await createClient();
  const { data: att } = await supabase
    .from("action_attachments")
    .select("file_path, uploaded_by")
    .eq("id", id)
    .maybeSingle();
  if (!att) return;
  if (att.uploaded_by !== user.id && !isManager(roles)) return;
  await supabase.from("action_attachments").delete().eq("id", id);
  if (att.file_path) {
    await supabase.storage.from("documents").remove([att.file_path]);
  }
  touch(actionId);
}

// ---- status -------------------------------------------------------
export async function completeAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireCanTouch(id);
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
  const { user } = await requireCanTouch(id);
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
  await requireCanTouch(id);
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
  for (const k of [
    "priority",
    "assigned_to",
    "due_date",
    "status",
    "detail",
    "title",
  ]) {
    if (formData.has(k)) patch[k] = orNull(formData.get(k));
  }
  const { error } = await supabase.from("actions").update(patch).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  touch(id);
  return { ok: true };
}

export async function deleteTask(id: string) {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/actions");
  const supabase = await createClient();
  await supabase.from("actions").delete().eq("id", id);
  touch();
  redirect("/actions");
}
