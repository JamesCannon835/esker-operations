import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AssetType = "vehicle" | "plant" | "trailer";
const TABLE: Record<AssetType, string> = {
  vehicle: "vehicles",
  plant: "plant",
  trailer: "trailers",
};

/**
 * Permanently removes an asset and everything attached to it — compliance
 * dates, faults (+ labour/parts), inspections (+ results), services,
 * documents, breakdowns. Uses the service-role client, so callers MUST have
 * already checked the user is a manager/admin.
 */
export async function hardDeleteAsset(
  assetType: AssetType,
  id: string,
): Promise<void> {
  const admin = createAdminClient();

  // Faults first (inspections are referenced by fault.source_inspection_id).
  await admin
    .from("faults")
    .delete()
    .eq("asset_type", assetType)
    .eq("asset_id", id);
  await admin
    .from("inspections")
    .delete()
    .eq("asset_type", assetType)
    .eq("asset_id", id);
  await admin
    .from("services")
    .delete()
    .eq("asset_type", assetType)
    .eq("asset_id", id);
  await admin
    .from("documents")
    .delete()
    .eq("asset_type", assetType)
    .eq("asset_id", id);
  await admin
    .from("compliance_items")
    .delete()
    .eq("asset_type", assetType)
    .eq("asset_id", id);

  if (assetType === "vehicle") {
    await admin.from("breakdowns").delete().eq("vehicle_id", id);
    // A trailer may point at this vehicle.
    await admin
      .from("trailers")
      .update({ assigned_vehicle_id: null })
      .eq("assigned_vehicle_id", id);
  }

  const { error } = await admin.from(TABLE[assetType]).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
