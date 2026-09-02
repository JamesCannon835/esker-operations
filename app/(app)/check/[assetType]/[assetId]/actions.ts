"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/assets";
import {
  dailyInspectionType,
  type AssetTypeT,
  type ItemResult,
} from "@/lib/inspections";

export type FormState = { error?: string };

export async function submitDailyCheck(
  assetType: AssetTypeT,
  assetId: string,
  templateId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (formData.get("signature") !== "on") {
    return { error: "Please confirm the declaration before submitting." };
  }

  const readingRaw = formData.get("reading");
  const reading =
    readingRaw != null && String(readingRaw).trim() !== ""
      ? Number(readingRaw)
      : null;
  if (readingRaw != null && String(readingRaw).trim() !== "" && Number.isNaN(reading)) {
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
      inspection_type: dailyInspectionType(assetType),
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

  const { error: resErr } = await supabase.from("inspection_item_results").insert(
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
    const { error: faultErr } = await supabase.from("faults").insert(
      failed.map((r) => ({
        asset_type: assetType,
        asset_id: assetId,
        reported_by: user.id,
        description: `Daily check: ${r.item.item_name}${
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

  revalidatePath("/inspections");
  revalidatePath("/faults");
  redirect(`/inspections/${inspection.id}`);
}
