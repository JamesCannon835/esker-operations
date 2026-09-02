import { createClient } from "@/lib/supabase/server";

/**
 * Resolves { asset_type, asset_id } pairs to human labels in two queries.
 * Assets are linked generically (not by FK), so this is a manual join.
 */
export async function resolveAssetLabels(
  refs: { asset_type: string; asset_id: string }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const vehicleIds = [
    ...new Set(refs.filter((r) => r.asset_type === "vehicle").map((r) => r.asset_id)),
  ];
  const plantIds = [
    ...new Set(refs.filter((r) => r.asset_type === "plant").map((r) => r.asset_id)),
  ];
  const trailerIds = [
    ...new Set(refs.filter((r) => r.asset_type === "trailer").map((r) => r.asset_id)),
  ];

  const supabase = await createClient();

  if (vehicleIds.length) {
    const { data } = await supabase
      .from("vehicles")
      .select("id, fleet_number, registration")
      .in("id", vehicleIds);
    for (const v of data ?? [])
      map.set(`vehicle:${v.id}`, `${v.fleet_number} · ${v.registration}`);
  }
  if (plantIds.length) {
    const { data } = await supabase
      .from("plant")
      .select("id, asset_number, plant_type")
      .in("id", plantIds);
    for (const p of data ?? [])
      map.set(
        `plant:${p.id}`,
        `${p.asset_number}${p.plant_type ? ` · ${p.plant_type}` : ""}`,
      );
  }
  if (trailerIds.length) {
    const { data } = await supabase
      .from("trailers")
      .select("id, registration")
      .in("id", trailerIds);
    for (const t of data ?? [])
      map.set(`trailer:${t.id}`, t.registration);
  }

  return map;
}

export function assetHref(assetType: string, assetId: string): string | null {
  if (assetType === "vehicle") return `/vehicles/${assetId}`;
  if (assetType === "plant") return `/plant/${assetId}`;
  if (assetType === "trailer") return `/trailers/${assetId}`;
  return null;
}
