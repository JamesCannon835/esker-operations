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
  let vQuery = supabase
    .from("vehicles")
    .select(
      "id, fleet_number, registration, make, model, vehicle_type, status, current_mileage, voided",
    )
    .order("fleet_number");
  let pQuery = supabase
    .from("plant")
    .select("id, asset_number, plant_type, make, model, status, current_hours, voided")
    .order("asset_number");
  let tQuery = supabase
    .from("trailers")
    .select(
      "id, registration, trailer_type, make, model, voided, vehicle:assigned_vehicle_id (fleet_number)",
    )
    .order("registration");
  if (!showVoided) {
    vQuery = vQuery.eq("voided", false);
    pQuery = pQuery.eq("voided", false);
    tQuery = tQuery.eq("voided", false);
  }

  const [
    { data: vehicles, error },
    { data: plant, error: plantError },
    { data: trailers, error: trailerError },
  ] = await Promise.all([vQuery, pQuery, tQuery]);

  // Group vehicles into the fixed categories, in order, with anything else last.
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
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn small ghost" href="/vehicles/import">
            Import
          </Link>
          <Link className="btn small" href="/vehicles/new">
            + Add vehicle
          </Link>
        </div>
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

      {/* --- Plant --- */}
      <div className="card">
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Plant</h2>
          <Link className="btn ghost small" href="/plant/new">
            + Add plant
          </Link>
        </div>
        {plantError && <div className="error">{plantError.message}</div>}
        {!plant || plant.length === 0 ? (
          <p className="empty">
            No plant yet. <Link href="/plant/new">Add the first item</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Asset no.</th>
                <th>Type</th>
                <th>Make / model</th>
                <th>Hours</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plant.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/plant/${p.id}`}>{p.asset_number}</Link>
                    {p.voided && <span className="muted"> · voided</span>}
                  </td>
                  <td className="muted">{p.plant_type ?? "—"}</td>
                  <td className="muted">
                    {[p.make, p.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="muted">
                    {p.current_hours != null
                      ? `${Number(p.current_hours).toLocaleString()} h`
                      : "—"}
                  </td>
                  <td>
                    <span className={`status-pill ${p.status}`}>
                      {STATUS_LABELS[p.status as AssetStatus] ?? p.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn ghost small" href={`/plant/${p.id}/edit`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Trailers --- */}
      <div className="card">
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Trailers</h2>
          <Link className="btn ghost small" href="/trailers/new">
            + Add trailer
          </Link>
        </div>
        {trailerError && <div className="error">{trailerError.message}</div>}
        {!trailers || trailers.length === 0 ? (
          <p className="empty">
            No trailers yet. <Link href="/trailers/new">Add the first one</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Type</th>
                <th>Make / model</th>
                <th>On vehicle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {trailers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/trailers/${t.id}`}>{t.registration}</Link>
                    {t.voided && <span className="muted"> · voided</span>}
                  </td>
                  <td className="muted">{t.trailer_type ?? "—"}</td>
                  <td className="muted">
                    {[t.make, t.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="muted">
                    {(t.vehicle as { fleet_number?: string } | null)
                      ?.fleet_number ?? "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      className="btn ghost small"
                      href={`/trailers/${t.id}/edit`}
                    >
                      Edit
                    </Link>
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
          <Link href="/vehicles?voided=1">Show voided records (all)</Link>
        )}
      </p>
    </>
  );
}
