import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssetQr } from "@/components/qr-code";
import { VoidControl } from "@/components/void-control";
import { setTrailerVoided } from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value ?? "—"}</div>
    </div>
  );
}

export default async function TrailerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trailer } = await supabase
    .from("trailers")
    .select("*, vehicle:assigned_vehicle_id (id, fleet_number, registration)")
    .eq("id", id)
    .maybeSingle();

  if (!trailer) notFound();

  const vehicle = trailer.vehicle as {
    id: string;
    fleet_number: string;
    registration: string;
  } | null;

  return (
    <>
      <Link className="link-back" href="/trailers">
        ← Trailers
      </Link>

      <div className="page-head">
        <h1>
          {trailer.registration}
          {trailer.trailer_type ? ` · ${trailer.trailer_type}` : ""}
        </h1>
        <Link className="btn small" href={`/trailers/${id}/edit`}>
          Edit
        </Link>
      </div>

      {trailer.voided && (
        <div className="voided-banner">
          This record is voided — hidden from the active trailer list.
        </div>
      )}

      <div className="card">
        <h2>Details</h2>
        <div className="detail-grid">
          <Row label="Make" value={trailer.make} />
          <Row label="Model" value={trailer.model} />
          <Row label="Year" value={trailer.year} />
          <Row label="VIN" value={trailer.vin} />
          <Row
            label="Assigned to vehicle"
            value={
              vehicle ? (
                <Link href={`/vehicles/${vehicle.id}`}>
                  {vehicle.fleet_number} · {vehicle.registration}
                </Link>
              ) : null
            }
          />
        </div>
      </div>

      {trailer.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{trailer.notes}</p>
        </div>
      )}

      <div className="card">
        <h2>QR code</h2>
        <AssetQr code={trailer.qr_code} />
      </div>

      <div className="card">
        <h2>Manage</h2>
        <p className="hint">
          Records are never deleted — voiding keeps them for audit while removing
          them from day-to-day lists.
        </p>
        <VoidControl
          action={setTrailerVoided.bind(null, id, !trailer.voided)}
          voided={trailer.voided}
          noun="trailer"
        />
      </div>
    </>
  );
}
