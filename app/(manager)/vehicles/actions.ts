"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { COMPLIANCE_TYPES, type ComplianceType } from "@/lib/compliance";

export type FormState = { error?: string };

function readVehicle(formData: FormData) {
  const registration = orNull(formData.get("registration"));
  return {
    registration,
    fleet_number: orNull(formData.get("fleet_number")) ?? registration,
    make: orNull(formData.get("make")),
    model: orNull(formData.get("model")),
    vehicle_type: orNull(formData.get("vehicle_type")),
    year: numOrNull(formData.get("year")),
    vin: orNull(formData.get("vin")),
    fuel_type: orNull(formData.get("fuel_type")),
    current_mileage: numOrNull(formData.get("current_mileage")),
    status: orNull(formData.get("status")) ?? "available",
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
  const v = readVehicle(formData);
  if (!v.registration) {
    return { error: "Registration is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      registration: v.registration,
      fleet_number: v.fleet_number,
      make: v.make,
      model: v.model,
      vehicle_type: v.vehicle_type,
      year: v.year,
      vin: v.vin,
    })
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  // Compliance dates entered on the setup form -> compliance_items rows.
  const complianceRows = COMPLIANCE_TYPES.flatMap((t) => {
    const due = orNull(formData.get(`c_${t}`));
    return due
      ? [
          {
            asset_type: "vehicle",
            asset_id: data.id,
            compliance_type: t as ComplianceType,
            due_date: due,
          },
        ]
      : [];
  });
  if (complianceRows.length) {
    await supabase.from("compliance_items").insert(complianceRows);
  }

  revalidatePath("/vehicles");
  revalidatePath("/compliance");
  redirect(`/vehicles/${data.id}`);
}

export async function updateVehicle(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const v = readVehicle(formData);
  if (!v.registration) {
    return { error: "Registration is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({ ...v, updated_at: new Date().toISOString() })
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
