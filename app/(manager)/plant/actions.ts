"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { COMPLIANCE_TYPES, type ComplianceType } from "@/lib/compliance";

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
  const v = readPlant(formData);
  if (!v.asset_number) {
    return { error: "Asset number is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plant")
    .insert({
      asset_number: v.asset_number,
      plant_type: v.plant_type,
      make: v.make,
      model: v.model,
      year: v.year,
      serial_number: v.serial_number,
    })
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  const complianceRows = COMPLIANCE_TYPES.flatMap((t) => {
    const due = orNull(formData.get(`c_${t}`));
    return due
      ? [
          {
            asset_type: "plant",
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

  revalidatePath("/plant");
  revalidatePath("/compliance");
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
