"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/auth";
import { orNull, friendlyDbError } from "@/lib/assets";
import { TRAINING_BUCKET } from "@/lib/training";

export type FormState = { error?: string };

function refresh(userId?: string) {
  revalidatePath("/training");
  revalidatePath("/training/courses");
  if (userId) revalidatePath(`/training/person/${userId}`);
  revalidatePath("/dashboard");
}

/**
 * Create a training record. The certificate (if any) has already been
 * uploaded to the `documents` bucket by the browser; `certificate_path`
 * is the object path it returned.
 */
export async function addTrainingRecord(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireManager();
  const supabase = await createClient();

  const user_id = orNull(formData.get("user_id"));
  const completed_date = orNull(formData.get("completed_date"));
  const picked = orNull(formData.get("course_name"));
  const courseName =
    orNull(formData.get("new_course")) ??
    (picked === "__other__" ? null : picked);

  if (!user_id) return { error: "Choose the person." };
  if (!courseName) return { error: "Choose or type a course." };
  if (!completed_date) return { error: "Enter the date completed." };

  // Resolve / create the course so the register columns stay tidy.
  let course_id: string | null = null;
  const { data: existing } = await supabase
    .from("training_courses")
    .select("id")
    .ilike("name", courseName)
    .maybeSingle();
  if (existing) {
    course_id = existing.id;
  } else {
    const { data: created, error: cErr } = await supabase
      .from("training_courses")
      .insert({ name: courseName })
      .select("id")
      .single();
    if (cErr) return { error: friendlyDbError(cErr.message) };
    course_id = created.id;
  }

  const certificate_path = orNull(formData.get("certificate_path"));
  const { error } = await supabase.from("training_records").insert({
    user_id,
    course_id,
    course_name: courseName,
    completed_date,
    expiry_date: orNull(formData.get("expiry_date")),
    certificate_path,
    certificate_name: orNull(formData.get("certificate_name")),
    notes: orNull(formData.get("notes")),
    created_by: user.id,
  });

  if (error) {
    if (certificate_path) {
      await supabase.storage.from(TRAINING_BUCKET).remove([certificate_path]);
    }
    return { error: friendlyDbError(error.message) };
  }

  refresh(user_id);
  redirect(`/training/person/${user_id}`);
}

export async function updateTrainingRecord(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const supabase = await createClient();

  const completed_date = orNull(formData.get("completed_date"));
  const picked = orNull(formData.get("course_name"));
  const courseName =
    orNull(formData.get("new_course")) ??
    (picked === "__other__" ? null : picked);
  if (!courseName) return { error: "Choose or type a course." };
  if (!completed_date) return { error: "Enter the date completed." };

  const patch: Record<string, unknown> = {
    course_name: courseName,
    completed_date,
    expiry_date: orNull(formData.get("expiry_date")),
    notes: orNull(formData.get("notes")),
    updated_at: new Date().toISOString(),
  };

  // Only replace the certificate if a new one was uploaded.
  const newPath = orNull(formData.get("certificate_path"));
  if (newPath) {
    patch.certificate_path = newPath;
    patch.certificate_name = orNull(formData.get("certificate_name"));
  }

  const { data: row, error } = await supabase
    .from("training_records")
    .update(patch)
    .eq("id", id)
    .select("user_id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  refresh(row.user_id);
  redirect(`/training/person/${row.user_id}`);
}

export async function voidTrainingRecord(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("training_records")
    .update({ voided: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("user_id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(row.user_id);
  redirect(`/training/person/${row.user_id}`);
}

export async function addCourse(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const name = orNull(formData.get("name"));
  if (!name) return { error: "Enter a course name." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_courses")
    .insert({ name })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };
  refresh();
  redirect("/training/courses");
}

export async function setCourseActive(id: string, active: boolean) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_courses")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh();
  redirect("/training/courses");
}
