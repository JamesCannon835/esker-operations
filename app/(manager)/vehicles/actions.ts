"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { syncComplianceDates } from "@/lib/compliance-server";
import { COMPLIANCE_TYPES, type ComplianceType } from "@/lib/compliance";

export type FormState = { error?: string };

export type VehicleImportRow = {
  registration: string;
  notes?: string;
  status?: string;
  dates?: Partial<Record<ComplianceType, string>>;
};
export type VehicleImportResult = {
  registration: string;
  status: "created" | "skipped" | "error";
  dates: number;
  detail?: string;
};
export type VehicleImportState = {
  error?: string;
  results?: VehicleImportResult[];
};

export async function importVehicles(
  _prev: VehicleImportState,
  formData: FormData,
): Promise<VehicleImportState> {
  await requireStaff();

  let rows: VehicleImportRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Could not read the pasted rows." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "Nothing to import." };
  }

  const supabase = await createClient();
  const results: VehicleImportResult[] = [];

  for (const row of rows) {
    const registration = (row.registration ?? "").trim();
    if (!registration) {
      results.push({ registration: "", status: "error", dates: 0, detail: "no registration" });
      continue;
    }

    const { data: existing } = await supabase
      .from("vehicles")
      .select("id")
      .ilike("registration", registration)
      .maybeSingle();
    if (existing) {
      results.push({ registration, status: "skipped", dates: 0, detail: "already exists" });
      continue;
    }

    const { data: created, error } = await supabase
      .from("vehicles")
      .insert({
        registration,
        fleet_number: registration,
        status: row.status || "available",
        notes: row.notes?.trim() || null,
      })
      .select("id")
      .single();
    if (error || !created) {
      results.push({ registration, status: "error", dates: 0, detail: friendlyDbError(error?.message ?? "insert failed") });
      continue;
    }

    let dateCount = 0;
    const entries = Object.entries(row.dates ?? {}).filter(
      ([t, d]) => COMPLIANCE_TYPES.includes(t as ComplianceType) && d,
    );
    if (entries.length) {
      const { error: cErr } = await supabase.from("compliance_items").insert(
        entries.map(([compliance_type, due_date]) => ({
          asset_type: "vehicle",
          asset_id: created.id,
          compliance_type,
          due_date,
          voided: false,
        })),
      );
      if (!cErr) dateCount = entries.length;
    }
    results.push({ registration, status: "created", dates: dateCount });
  }

  revalidatePath("/vehicles");
  revalidatePath("/compliance");
  return { results };
}

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

  await syncComplianceDates("vehicle", data.id, formData);

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

  await syncComplianceDates("vehicle", id, formData);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/compliance");
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
