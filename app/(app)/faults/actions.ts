"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orNull, friendlyDbError } from "@/lib/assets";
import { FAULT_SEVERITIES, type FaultSeverity } from "@/lib/inspections";

export type FormState = { error?: string };

export async function reportFault(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assetRef = orNull(formData.get("asset")); // "vehicle:<id>"
  const description = orNull(formData.get("description"));
  const severityRaw = orNull(formData.get("severity")) ?? "normal";
  const location = orNull(formData.get("location"));
  const category = orNull(formData.get("category"));
  const safe_to_operate = formData.get("safe_to_operate") !== "no";

  if (!assetRef || !assetRef.includes(":")) {
    return { error: "Choose the asset the fault is on." };
  }
  if (!description) {
    return { error: "Describe the fault." };
  }

  const [asset_type, asset_id] = assetRef.split(":");
  const severity: FaultSeverity = FAULT_SEVERITIES.includes(
    severityRaw as FaultSeverity,
  )
    ? (severityRaw as FaultSeverity)
    : "normal";

  const { data, error } = await supabase
    .from("faults")
    .insert({
      asset_type,
      asset_id,
      reported_by: user.id,
      description,
      severity,
      location,
      category,
      safe_to_operate,
      status: "reported",
    })
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/faults");
  redirect(`/faults/${data.id}`);
}
