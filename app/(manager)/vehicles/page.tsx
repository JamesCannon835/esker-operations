import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type AssetStatus } from "@/lib/assets";
import { vehicleName } from "@/lib/asset-name";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ voided?: string }>;
}) {
  const { voided } = await searchParams;
  const showVoided = voided === "1";

  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select(
      "id, fleet_number, registration, make, model, vehicle_type, status, current_mileage, voided",
    )
    .order("fleet_number");
  if (!showVoided) query = query.eq("voided", false);

  const { data: vehicles, error } = await query;

  return (
    <>
      <div className="page-head">
        <h1>Vehicles</h1>
        <Link className="btn small" href="/vehicles/new">
          + Add vehicle
        </Link>
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {!vehicles || vehicles.length === 0 ? (
          <p className="empty">
            No vehicles yet. <Link href="/vehicles/new">Add the first one</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Type</th>
                <th>Make / model</th>
                <th>Mileage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/vehicles/${v.id}`}>
                      {vehicleName(v.fleet_number, v.registration)}
                    </Link>
                    {v.voided && <span className="muted"> · voided</span>}
                  </td>
                  <td className="muted">{v.vehicle_type ?? "—"}</td>
                  <td className="muted">
                    {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="muted">
                    {v.current_mileage != null
                      ? `${Number(v.current_mileage).toLocaleString()} km`
                      : "—"}
                  </td>
                  <td>
                    <span className={`status-pill ${v.status}`}>
                      {STATUS_LABELS[v.status as AssetStatus] ?? v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="field-hint">
        {showVoided ? (
          <Link href="/vehicles">Hide voided records</Link>
        ) : (
          <Link href="/vehicles?voided=1">Show voided records</Link>
        )}
      </p>
    </>
  );
}
