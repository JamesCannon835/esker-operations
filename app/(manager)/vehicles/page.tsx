import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_LABELS,
  VEHICLE_CATEGORIES,
  type AssetStatus,
} from "@/lib/assets";
import { vehicleName } from "@/lib/asset-name";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  fleet_number: string | null;
  registration: string | null;
  make: string | null;
  model: string | null;
  vehicle_type: string | null;
  status: string;
  current_mileage: number | null;
  voided: boolean;
};

const UNCATEGORISED = "Uncategorised";

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

  // Group into the fixed categories, in order, with anything else last.
  const groups = new Map<string, Row[]>();
  for (const v of (vehicles ?? []) as Row[]) {
    const key =
      v.vehicle_type && v.vehicle_type.trim() !== ""
        ? v.vehicle_type
        : UNCATEGORISED;
    const bucket = groups.get(key);
    if (bucket) bucket.push(v);
    else groups.set(key, [v]);
  }
  const orderedKeys = [
    ...VEHICLE_CATEGORIES.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter(
      (k) => !VEHICLE_CATEGORIES.includes(k as never) && k !== UNCATEGORISED,
    ),
    ...(groups.has(UNCATEGORISED) ? [UNCATEGORISED] : []),
  ];

  return (
    <>
      <div className="page-head">
        <h1>Vehicles</h1>
        <Link className="btn small" href="/vehicles/new">
          + Add vehicle
        </Link>
      </div>

      {error && <div className="error">{error.message}</div>}

      {!vehicles || vehicles.length === 0 ? (
        <div className="card">
          <p className="empty">
            No vehicles yet. <Link href="/vehicles/new">Add the first one</Link>.
          </p>
        </div>
      ) : (
        orderedKeys.map((key) => (
          <div className="card" key={key}>
            <div className="page-head" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>{key}</h2>
              <span className="muted">{groups.get(key)!.length}</span>
            </div>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Make / model</th>
                  <th>Mileage</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.get(key)!.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/vehicles/${v.id}`}>
                        {vehicleName(v.fleet_number, v.registration)}
                      </Link>
                      {v.voided && <span className="muted"> · voided</span>}
                    </td>
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
                    <td style={{ textAlign: "right" }}>
                      <Link
                        className="btn ghost small"
                        href={`/vehicles/${v.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

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
