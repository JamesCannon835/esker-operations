import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type AssetStatus } from "@/lib/assets";
import { AssetQr } from "@/components/qr-code";
import { VoidControl } from "@/components/void-control";
import { setVehicleVoided } from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value ?? "—"}</div>
    </div>
  );
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}
function fmtNum(n: number | null, suffix = "") {
  return n != null ? `${Number(n).toLocaleString()}${suffix}` : "—";
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*, driver:assigned_driver_id (full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!vehicle) notFound();

  const driverName =
    (vehicle.driver as { full_name?: string } | null)?.full_name ?? null;

  return (
    <>
      <Link className="link-back" href="/vehicles">
        ← Vehicles
      </Link>

      <div className="page-head">
        <h1>
          {vehicle.fleet_number} · {vehicle.registration}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn small ghost" href={`/check/vehicle/${id}`}>
            Daily check
          </Link>
          <Link
            className="btn small ghost"
            href={`/faults/new?type=vehicle&id=${id}`}
          >
            Report fault
          </Link>
          <Link className="btn small" href={`/vehicles/${id}/edit`}>
            Edit
          </Link>
        </div>
      </div>

      {vehicle.voided && (
        <div className="voided-banner">
          This record is voided — hidden from the active fleet list.
        </div>
      )}

      <div className="card">
        <h2>Details</h2>
        <div className="detail-grid">
          <Row
            label="Status"
            value={
              <span className={`status-pill ${vehicle.status}`}>
                {STATUS_LABELS[vehicle.status as AssetStatus] ?? vehicle.status}
              </span>
            }
          />
          <Row label="Assigned driver" value={driverName} />
          <Row label="Make" value={vehicle.make} />
          <Row label="Model" value={vehicle.model} />
          <Row label="Vehicle type" value={vehicle.vehicle_type} />
          <Row label="Year" value={vehicle.year} />
          <Row label="VIN" value={vehicle.vin} />
          <Row label="Fuel type" value={vehicle.fuel_type} />
          <Row
            label="Current mileage"
            value={fmtNum(vehicle.current_mileage, " km")}
          />
        </div>
      </div>

      <div className="card">
        <h2>Service schedule</h2>
        <div className="detail-grid">
          <Row
            label="Service interval"
            value={fmtNum(vehicle.service_interval_km, " km")}
          />
          <Row
            label="Next service at"
            value={fmtNum(vehicle.next_service_mileage, " km")}
          />
          <Row
            label="Next service date"
            value={fmtDate(vehicle.next_service_date)}
          />
        </div>
      </div>

      {vehicle.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{vehicle.notes}</p>
        </div>
      )}

      <div className="card">
        <h2>QR code</h2>
        <AssetQr code={vehicle.qr_code} />
      </div>

      <div className="card">
        <h2>Manage</h2>
        <p className="hint">
          Records are never deleted — voiding keeps them for audit while removing
          them from day-to-day lists.
        </p>
        <VoidControl
          action={setVehicleVoided.bind(null, id, !vehicle.voided)}
          voided={vehicle.voided}
          noun="vehicle"
        />
      </div>
    </>
  );
}
