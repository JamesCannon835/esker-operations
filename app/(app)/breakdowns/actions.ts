"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { breakdownStage, NEXT_STEP, type BreakdownStage } from "@/lib/breakdowns";

export type FormState = { error?: string };

export async function reportBreakdown(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const vehicle_id = orNull(formData.get("vehicle_id"));
  const problem_description = orNull(formData.get("problem_description"));
  if (!vehicle_id) return { error: "Choose the vehicle." };
  if (!problem_description) return { error: "Describe what's wrong." };

  const immobilised = formData.get("immobilised") === "yes";

  const { data: bd, error } = await supabase
    .from("breakdowns")
    .insert({
      vehicle_id,
      driver_id: user.id,
      problem_description,
      immobilised,
      location_lat: numOrNull(formData.get("location_lat")),
      location_lng: numOrNull(formData.get("location_lng")),
      photo_url: orNull(formData.get("photo_url")),
      recovery_required: immobilised,
    })
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  // Also raise a fault so it enters the workshop queue.
  const { data: v } = await supabase
    .from("vehicles")
    .select("fleet_number")
    .eq("id", vehicle_id)
    .maybeSingle();

  await supabase.from("faults").insert({
    asset_type: "vehicle",
    asset_id: vehicle_id,
    reported_by: user.id,
    description: `Breakdown${v?.fleet_number ? ` (${v.fleet_number})` : ""}: ${problem_description}`,
    category: "Breakdown",
    severity: immobilised ? "critical" : "urgent",
    safe_to_operate: false,
    status: "reported",
  });

  // Flag the vehicle.
  await supabase
    .from("vehicles")
    .update({ status: "breakdown", updated_at: new Date().toISOString() })
    .eq("id", vehicle_id);

  revalidatePath("/breakdowns");
  revalidatePath("/faults");
  redirect(`/breakdowns/${bd.id}`);
}

export async function advanceBreakdown(id: string, fromStage: BreakdownStage) {
  const supabase = await createClient();

  const { data: bd } = await supabase
    .from("breakdowns")
    .select(
      "reported_at, mechanic_notified_at, mechanic_arrived_at, repair_completed_at, returned_to_service_at, vehicle_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!bd) return;

  // Only advance if the caller's view matches reality.
  if (breakdownStage(bd) !== fromStage) {
    revalidatePath(`/breakdowns/${id}`);
    return;
  }

  const step = NEXT_STEP[fromStage];
  if (!step) return;

  const { error } = await supabase
    .from("breakdowns")
    .update({ [step.column]: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));

  // When back in service, clear the vehicle's breakdown status.
  if (step.column === "returned_to_service_at" && bd.vehicle_id) {
    await supabase
      .from("vehicles")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .eq("id", bd.vehicle_id);
  }

  revalidatePath("/breakdowns");
  revalidatePath(`/breakdowns/${id}`);
}
