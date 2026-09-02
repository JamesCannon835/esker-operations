"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string };

function readPlant(formData: FormData) {
  return {
    asset_number: orNull(formData.get("asset_number")),
    plant_type: orNull(formData.get("plant_type")),
    make: orNull(formData.get("make")),
    model: orNull(formData.get("model")),
    year: numOrNull(formData.get("year")),
    serial_number: orNull(formData.get("serial_number")),
    current_hours: numOrNull(formData.get("current_hours")),
    status: orNull(formData.get("status")) ?? "available",
    assigned_operator_id: orNull(formData.get("assigned_operator_id")),
    service_interval_hours: numOrNull(formData.get("service_interval_hours")),
    next_service_hours: numOrNull(formData.get("next_service_hours")),
    next_service_date: orNull(formData.get("next_service_date")),
    notes: orNull(formData.get("notes")),
  };
}

export async function createPlant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readPlant(formData);
  if (!values.asset_number) {
    return { error: "Asset number is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plant")
    .insert(values)
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/plant");
  redirect(`/plant/${data.id}`);
}

export async function updatePlant(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readPlant(formData);
  if (!values.asset_number) {
    return { error: "Asset number is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("plant")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/plant");
  revalidatePath(`/plant/${id}`);
  redirect(`/plant/${id}`);
}

export async function setPlantVoided(id: string, voided: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plant")
    .update({ voided, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendlyDbError(error.message));

  revalidatePath("/plant");
  revalidatePath(`/plant/${id}`);
  redirect(`/plant/${id}`);
}
