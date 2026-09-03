"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orNull, friendlyDbError } from "@/lib/assets";
import {
  FAULT_SEVERITIES,
  FAULT_SEVERITY_LABELS,
  type FaultSeverity,
} from "@/lib/inspections";
import { resolveAssetLabels } from "@/lib/asset-labels";
import { notifyManagers, SITE_URL } from "@/lib/notify";

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

  // Tell the transport managers + admins a fault has come in.
  const [labels, { data: me }] = await Promise.all([
    resolveAssetLabels([{ asset_type, asset_id }]),
    supabase.from("users").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const assetLabel = labels.get(`${asset_type}:${asset_id}`) ?? asset_type;
  await notifyManagers(
    `New fault reported — ${assetLabel}`,
    `${me?.full_name ?? "Someone"} reported a fault on ${assetLabel}.\n\n` +
      `${description}\n` +
      `Severity: ${FAULT_SEVERITY_LABELS[severity]}\n` +
      (safe_to_operate ? "" : "Reported as NOT safe to operate.\n") +
      `\nOpen it: ${SITE_URL}/faults/${data.id}\n`,
  );

  revalidatePath("/faults");
  redirect(`/faults/${data.id}`);
}
