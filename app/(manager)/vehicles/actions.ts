"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string };

function readVehicle(formData: FormData) {
  return {
    fleet_number: orNull(formData.get("fleet_number")),
    registration: orNull(formData.get("registration")),
    make: orNull(formData.get("make")),
    model: orNull(formData.get("model")),
    vehicle_type: orNull(formData.get("vehicle_type")),
    year: numOrNull(formData.get("year")),
    vin: orNull(formData.get("vin")),
    fuel_type: orNull(formData.get("fuel_type")),
    current_mileage: numOrNull(formData.get("current_mileage")),
    status: orNull(formData.get("status")) ?? "available",
    assigned_driver_id: orNull(formData.get("assigned_driver_id")),
    service_interval_km: numOrNull(formData.get("service_interval_km")),
    next_service_mileage: numOrNull(formData.get("next_service_mileage")),
    next_service_date: orNull(formData.get("next_service_date")),
    notes: orNull(formData.get("notes")),
  };
}

export async function createVehicle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readVehicle(formData);
  if (!values.fleet_number || !values.registration) {
    return { error: "Fleet number and registration are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert(values)
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/vehicles");
  redirect(`/vehicles/${data.id}`);
}

export async function updateVehicle(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readVehicle(formData);
  if (!values.fleet_number || !values.registration) {
    return { error: "Fleet number and registration are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

export async function setVehicleVoided(id: string, voided: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({ voided, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendlyDbError(error.message));

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}
