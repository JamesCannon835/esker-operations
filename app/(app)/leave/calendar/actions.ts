"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orNull, friendlyDbError } from "@/lib/assets";
import { readCategory } from "@/lib/calendar";

export type FormState = { error?: string };

function refresh() {
  revalidatePath("/leave/calendar", "layout");
  revalidatePath("/dashboard");
}

function readDates(formData: FormData) {
  const start_date = orNull(formData.get("start_date"));
  const end_date = orNull(formData.get("end_date")) ?? start_date;
  return { start_date, end_date };
}

/** Optional link to a vehicle, e.g. the truck that's going for test. */
function readAsset(formData: FormData) {
  const asset_id = orNull(formData.get("asset_id"));
  return asset_id
    ? { asset_type: "vehicle", asset_id }
    : { asset_type: null, asset_id: null };
}

export async function createEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireManager();
  const supabase = await createClient();

  const title = orNull(formData.get("title"));
  const { start_date, end_date } = readDates(formData);
  if (!title) return { error: "Give the event a title." };
  if (!start_date) return { error: "Pick a date." };
  if (end_date! < start_date) return { error: "The end date is before the start." };

  const { error } = await supabase.from("calendar_events").insert({
    title,
    category: readCategory(formData.get("category")),
    start_date,
    end_date,
    note: orNull(formData.get("note")),
    ...readAsset(formData),
    created_by: user.id,
  });
  if (error) return { error: friendlyDbError(error.message) };

  refresh();
  redirect("/leave/calendar");
}

export async function updateEvent(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const supabase = await createClient();

  const title = orNull(formData.get("title"));
  const { start_date, end_date } = readDates(formData);
  if (!title) return { error: "Give the event a title." };
  if (!start_date) return { error: "Pick a date." };
  if (end_date! < start_date) return { error: "The end date is before the start." };

  const { error } = await supabase
    .from("calendar_events")
    .update({
      title,
      category: readCategory(formData.get("category")),
      start_date,
      end_date,
      note: orNull(formData.get("note")),
      ...readAsset(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  refresh();
  redirect("/leave/calendar");
}

export async function deleteEvent(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh();
  redirect("/leave/calendar");
}
