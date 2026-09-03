import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { vehicleName } from "@/lib/asset-name";

export const dynamic = "force-dynamic";

export default async function CheckLandingPage() {
  const { roles } = await requireUser();
  const supabase = await createClient();

  const manager = isManager(roles);
  const showVehicles = manager || hasRole(roles, "driver") || hasRole(roles, "mechanic");
  const showPlant = manager || hasRole(roles, "plant_operator") || hasRole(roles, "mechanic");

  const [{ data: vehicles }, { data: plant }] = await Promise.all([
    showVehicles
      ? supabase
          .from("vehicles")
          .select("id, fleet_number, registration")
          .eq("voided", false)
          .order("registration")
      : Promise.resolve({ data: [] }),
    showPlant
      ? supabase
          .from("plant")
          .select("id, asset_number, plant_type")
          .eq("voided", false)
          .order("asset_number")
      : Promise.resolve({ data: [] }),
  ]);

  const v = vehicles ?? [];
  const p = plant ?? [];
  const nothing = v.length === 0 && p.length === 0;

  return (
    <>
      <div className="page-head">
        <h1>Daily check</h1>
      </div>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Pick the vehicle or plant you&apos;re using today.
      </p>

      {nothing && (
        <div className="card">
          <p className="empty">Nothing on record to check yet.</p>
        </div>
      )}

      {v.length > 0 && (
        <div className="card">
          <h2>Vehicles</h2>
          <table className="list-table">
            <tbody>
              {v.map((row) => (
                <tr key={row.id}>
                  <td>{vehicleName(row.fleet_number, row.registration)}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/check/vehicle/${row.id}`}>
                      Start check
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.length > 0 && (
        <div className="card">
          <h2>Plant</h2>
          <table className="list-table">
            <tbody>
              {p.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.asset_number}
                    {row.plant_type ? ` · ${row.plant_type}` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/check/plant/${row.id}`}>
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
