"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string };

export async function logService(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assetRef = orNull(formData.get("asset"));
  if (!assetRef || !assetRef.includes(":")) {
    return { error: "Choose the asset that was serviced." };
  }
  const [asset_type, asset_id] = assetRef.split(":");

  const service_date = orNull(formData.get("service_date"));
  if (!service_date) return { error: "Service date is required." };

  const { data, error } = await supabase
    .from("services")
    .insert({
      asset_type,
      asset_id,
      service_date,
      mileage_or_hours: numOrNull(formData.get("mileage_or_hours")),
      performed_by: user.id,
      notes: orNull(formData.get("notes")),
      cost: numOrNull(formData.get("cost")),
    })
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/services");
  redirect(`/services/${data.id}`);
}

export async function deleteService(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  revalidatePath("/services");
  redirect("/services");
}
