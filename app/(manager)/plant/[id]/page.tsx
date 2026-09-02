import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type AssetStatus } from "@/lib/assets";
import { AssetQr } from "@/components/qr-code";
import { VoidControl } from "@/components/void-control";
import { AssetServicePanel } from "@/components/asset-service-panel";
import { AssetCompliancePanel } from "@/components/asset-compliance-panel";
import { fmtNumber as fmtNum } from "@/lib/format";
import { setPlantVoided } from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value ?? "—"}</div>
    </div>
  );
}

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: plant } = await supabase
    .from("plant")
    .select("*, operator:assigned_operator_id (full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!plant) notFound();

  const operatorName =
    (plant.operator as { full_name?: string } | null)?.full_name ?? null;

  return (
    <>
      <Link className="link-back" href="/plant">
        ← Plant
      </Link>

      <div className="page-head">
        <h1>
          {plant.asset_number}
          {plant.plant_type ? ` · ${plant.plant_type}` : ""}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn small ghost" href={`/check/plant/${id}`}>
            Daily check
          </Link>
          <Link
            className="btn small ghost"
            href={`/inspections/new?asset=plant:${id}&type=thirteen_week`}
          >
            13-week
          </Link>
          <Link
            className="btn small ghost"
            href={`/faults/new?type=plant&id=${id}`}
          >
            Report fault
          </Link>
          <Link className="btn small" href={`/plant/${id}/edit`}>
            Edit
          </Link>
        </div>
      </div>

      {plant.voided && (
        <div className="voided-banner">
          This record is voided — hidden from the active plant list.
        </div>
      )}

      <div className="card">
        <h2>Details</h2>
        <div className="detail-grid">
          <Row
            label="Status"
            value={
              <span className={`status-pill ${plant.status}`}>
                {STATUS_LABELS[plant.status as AssetStatus] ?? plant.status}
              </span>
            }
          />
          <Row label="Assigned operator" value={operatorName} />
          <Row label="Make" value={plant.make} />
          <Row label="Model" value={plant.model} />
          <Row label="Year" value={plant.year} />
          <Row label="Serial number" value={plant.serial_number} />
          <Row label="Current hours" value={fmtNum(plant.current_hours, " h")} />
        </div>
      </div>

      <AssetServicePanel
        assetType="plant"
        assetId={id}
        currentReading={plant.current_hours}
        nextServiceReading={plant.next_service_hours}
        nextServiceDate={plant.next_service_date}
        canLog
      />

      <AssetCompliancePanel assetType="plant" assetId={id} />

      {plant.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{plant.notes}</p>
        </div>
      )}

      <div className="card">
        <h2>QR code</h2>
        <AssetQr code={plant.qr_code} />
      </div>

      <div className="card">
        <h2>Manage</h2>
        <p className="hint">
          Records are never deleted — voiding keeps them for audit while removing
          them from day-to-day lists.
        </p>
        <VoidControl
          action={setPlantVoided.bind(null, id, !plant.voided)}
          voided={plant.voided}
          noun="plant item"
        />
      </div>
    </>
  );
}
