import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function CheckLandingPage() {
  const { user, roles } = await requireUser();
  const supabase = await createClient();

  const canSeeAll = isManager(roles) || hasRole(roles, "mechanic");

  const [{ data: myVehicles }, { data: myPlant }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, fleet_number, registration")
      .eq("voided", false)
      .eq("assigned_driver_id", user.id)
      .order("fleet_number"),
    supabase
      .from("plant")
      .select("id, asset_number, plant_type")
      .eq("voided", false)
      .eq("assigned_operator_id", user.id)
      .order("asset_number"),
  ]);

  const allVehicles = canSeeAll
    ? (
        await supabase
          .from("vehicles")
          .select("id, fleet_number, registration")
          .eq("voided", false)
          .order("fleet_number")
      ).data ?? []
    : [];
  const allPlant = canSeeAll
    ? (
        await supabase
          .from("plant")
          .select("id, asset_number, plant_type")
          .eq("voided", false)
          .order("asset_number")
      ).data ?? []
    : [];

  const vehicles = canSeeAll ? allVehicles : (myVehicles ?? []);
  const plant = canSeeAll ? allPlant : (myPlant ?? []);
  const nothing = vehicles.length === 0 && plant.length === 0;

  return (
    <>
      <div className="page-head">
        <h1>Daily check</h1>
      </div>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        {canSeeAll
          ? "Choose any asset to inspect."
          : "Choose the asset assigned to you."}
      </p>

      {nothing && (
        <div className="card">
          <p className="empty">
            Nothing to check. {canSeeAll ? "No assets on record yet." : "No vehicle or plant is assigned to you — ask your manager."}
          </p>
        </div>
      )}

      {vehicles.length > 0 && (
        <div className="card">
          <h2>Vehicles</h2>
          <table className="list-table">
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.fleet_number} · {v.registration}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/check/vehicle/${v.id}`}>
                      Start check
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plant.length > 0 && (
        <div className="card">
          <h2>Plant</h2>
          <table className="list-table">
            <tbody>
              {plant.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.asset_number}
                    {p.plant_type ? ` · ${p.plant_type}` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/check/plant/${p.id}`}>
                      Start check
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
