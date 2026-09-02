import { createClient } from "@/lib/supabase/server";

export type AssetOption = { value: string; label: string; group: string };

/** All non-voided assets as { value: "type:id", label } for a fault picker. */
export async function getAssetOptions(): Promise<AssetOption[]> {
  const supabase = await createClient();
  const [{ data: vehicles }, { data: plant }, { data: trailers }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id, fleet_number, registration")
        .eq("voided", false)
        .order("fleet_number"),
      supabase
        .from("plant")
        .select("id, asset_number, plant_type")
        .eq("voided", false)
        .order("asset_number"),
      supabase
        .from("trailers")
        .select("id, registration")
        .eq("voided", false)
        .order("registration"),
    ]);

  return [
    ...(vehicles ?? []).map((v) => ({
      value: `vehicle:${v.id}`,
      label: `${v.fleet_number} · ${v.registration}`,
      group: "Vehicles",
    })),
    ...(plant ?? []).map((p) => ({
      value: `plant:${p.id}`,
      label: `${p.asset_number}${p.plant_type ? ` · ${p.plant_type}` : ""}`,
      group: "Plant",
    })),
    ...(trailers ?? []).map((t) => ({
      value: `trailer:${t.id}`,
      label: t.registration,
      group: "Trailers",
    })),
  ];
}
