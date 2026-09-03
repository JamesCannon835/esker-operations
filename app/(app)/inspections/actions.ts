"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, orNull, numOrNull } from "@/lib/assets";
import { INSPECTION_TYPE_LABELS, type ItemResult } from "@/lib/inspections";
import { resolveAssetLabels } from "@/lib/asset-labels";
import { notifyManagers, notifyWorkshop, SITE_URL } from "@/lib/notify";

export type FormState = { error?: string };

export type InspectionTarget = {
  assetType: string;
  assetId: string;
  templateId: string;
  inspectionType: string;
};

export async function submitInspection(
  target: InspectionTarget,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { assetType, assetId, templateId, inspectionType } = target;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (formData.get("signature") !== "on") {
    return { error: "Please confirm the declaration before submitting." };
  }

  const readingRaw = formData.get("reading");
  const hasReading =
    readingRaw != null && String(readingRaw).trim() !== "";
  const reading = hasReading ? Number(readingRaw) : null;
  if (hasReading && Number.isNaN(reading)) {
    return { error: "Mileage / hours must be a number." };
  }

  const safeToOperate = formData.get("safe_to_operate") !== "no";

  const { data: items } = await supabase
    .from("inspection_template_items")
    .select("id, item_name")
    .eq("template_id", templateId);

  if (!items || items.length === 0) {
    return { error: "This checklist has no items." };
  }

  const results = items.map((item) => {
    const raw = String(formData.get(`item_${item.id}`) ?? "pass");
    const result: ItemResult =
      raw === "fail" ? "fail" : raw === "na" ? "na" : "pass";
    const comment = String(formData.get(`comment_${item.id}`) ?? "").trim();
    return { item, result, comment: comment || null };
  });

  const anyFail = results.some((r) => r.result === "fail");

  const { data: inspection, error: insErr } = await supabase
    .from("inspections")
    .insert({
      inspection_type: inspectionType,
      asset_type: assetType,
      asset_id: assetId,
      template_id: templateId,
      completed_by: user.id,
      mileage_or_hours: reading,
      result: anyFail ? "fail" : "pass",
      signature_confirmed: true,
    })
    .select("id")
    .single();

  if (insErr) return { error: friendlyDbError(insErr.message) };

  const { error: resErr } = await supabase
    .from("inspection_item_results")
    .insert(
      results.map((r) => ({
        inspection_id: inspection.id,
        template_item_id: r.item.id,
        result: r.result,
        comment: r.comment,
      })),
    );
  if (resErr) return { error: friendlyDbError(resErr.message) };

  const failed = results.filter((r) => r.result === "fail");
  if (failed.length > 0) {
    const prefix = INSPECTION_TYPE_LABELS[inspectionType] ?? "Inspection";
    const { error: faultErr } = await supabase.from("faults").insert(
      failed.map((r) => ({
        asset_type: assetType,
        asset_id: assetId,
        reported_by: user.id,
        description: `${prefix}: ${r.item.item_name}${
          r.comment ? ` — ${r.comment}` : ""
        }`,
        severity: "normal",
        safe_to_operate: safeToOperate,
        status: "reported",
        source_inspection_id: inspection.id,
      })),
    );
    if (faultErr) return { error: friendlyDbError(faultErr.message) };
  }

  // A service carried out during this inspection -> a service record.
  if (formData.get("service_done") === "on") {
    const { error: svcErr } = await supabase.from("services").insert({
      asset_type: assetType,
      asset_id: assetId,
      service_date: new Date().toISOString().slice(0, 10),
      mileage_or_hours: reading,
      performed_by: user.id,
      notes: orNull(formData.get("service_notes")),
      labour_hours: numOrNull(formData.get("service_hours")),
    });
    if (svcErr) return { error: friendlyDbError(svcErr.message) };
  }

  // Email the transport managers + admins.
  const isDaily =
    inspectionType === "daily_vehicle" || inspectionType === "daily_plant";
  const [labelMap, { data: me }] = await Promise.all([
    resolveAssetLabels([{ asset_type: assetType, asset_id: assetId }]),
    supabase.from("users").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const assetLabel = labelMap.get(`${assetType}:${assetId}`) ?? assetType;
  const who = me?.full_name ?? "Someone";
  const failLines = failed
    .map((r) => `• ${r.item.item_name}${r.comment ? ` — ${r.comment}` : ""}`)
    .join("\n");

  if (!isDaily) {
    // A mechanic completed an inspection / maintenance report.
    await notifyManagers(
      `Inspection completed — ${assetLabel} (${anyFail ? "issues found" : "passed"})`,
      `${who} completed an inspection on ${assetLabel}.\n\n` +
        `Result: ${anyFail ? "Fail — issues found" : "Pass"}\n` +
        (formData.get("service_done") === "on"
          ? "A service was carried out during this inspection.\n"
          : "") +
        (failed.length > 0 ? `\nItems failed:\n${failLines}\n` : "") +
        `\nView it: ${SITE_URL}/inspections/${inspection.id}\n`,
    );
  } else if (failed.length > 0) {
    // A driver's / operator's daily check raised faults.
    await notifyWorkshop(
      `Daily check raised ${failed.length} fault(s) — ${assetLabel}`,
      `${who}'s daily check on ${assetLabel} raised ${failed.length} fault(s):\n\n` +
        `${failLines}\n\n` +
        (safeToOperate ? "" : "Marked NOT safe to operate.\n\n") +
        `Faults list: ${SITE_URL}/faults\n`,
    );
  }

  revalidatePath("/inspections");
  revalidatePath("/faults");
  redirect(`/inspections/${inspection.id}`);
}
