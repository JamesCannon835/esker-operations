import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { fmtDateTime } from "@/lib/format";
import {
  breakdownStage,
  BREAKDOWN_STAGE_LABELS,
  NEXT_STEP,
  downtimeMs,
  formatDowntime,
} from "@/lib/breakdowns";
import { ConfirmButton } from "@/components/confirm-button";
import { advanceBreakdown } from "../actions";

export const dynamic = "force-dynamic";

const STEPS: { key: string; label: string; col: keyof BdTimestamps }[] = [
  { key: "reported", label: "Reported", col: "reported_at" },
  { key: "notified", label: "Mechanic notified", col: "mechanic_notified_at" },
  { key: "on_site", label: "Mechanic on site", col: "mechanic_arrived_at" },
  { key: "repaired", label: "Repair complete", col: "repair_completed_at" },
  {
    key: "back",
    label: "Back in service",
    col: "returned_to_service_at",
  },
];

type BdTimestamps = {
  reported_at: string;
  mechanic_notified_at: string | null;
  mechanic_arrived_at: string | null;
  repair_completed_at: string | null;
  returned_to_service_at: string | null;
};

export default async function BreakdownDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { roles } = await requireUser();
  const canManage = isManager(roles) || hasRole(roles, "mechanic");

  const supabase = await createClient();
  const { data: b } = await supabase
    .from("breakdowns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  const [{ data: vehicle }, { data: driver }] = await Promise.all([
    b.vehicle_id
      ? supabase
          .from("vehicles")
          .select("id, fleet_number, registration")
          .eq("id", b.vehicle_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    b.driver_id
      ? supabase
          .from("users")
          .select("full_name")
          .eq("id", b.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const stage = breakdownStage(b);
  const next = NEXT_STEP[stage];
  const vLabel = vehicle
    ? `${vehicle.fleet_number} · ${vehicle.registration}`
    : "—";
  const mapUrl =
    b.location_lat && b.location_lng
      ? `https://www.google.com/maps?q=${b.location_lat},${b.location_lng}`
      : null;

  return (
    <>
      <Link className="link-back" href="/breakdowns">
        ← Breakdowns
      </Link>
      <div className="page-head">
        <h1>Breakdown — {vLabel}</h1>
        <span
          className={stage === "back_in_service" ? "ok" : "blocked"}
          style={{ fontWeight: 700 }}
        >
          {BREAKDOWN_STAGE_LABELS[stage]}
        </span>
      </div>

      {b.immobilised && stage !== "back_in_service" && (
        <div className="voided-banner">
          Vehicle immobilised — recovery may be required.
        </div>
      )}

      <div className="card">
        <h2>{b.problem_description}</h2>
        <div className="detail-grid" style={{ marginTop: 12 }}>
          <div>
            <div className="label">Reported</div>
            <div className="value">{fmtDateTime(b.reported_at)}</div>
          </div>
          <div>
            <div className="label">Driver</div>
            <div className="value">
              {(driver as { full_name?: string } | null)?.full_name ?? "—"}
            </div>
          </div>
          <div>
            <div className="label">Vehicle</div>
            <div className="value">
              {vehicle ? (
                <Link href={`/vehicles/${vehicle.id}`}>{vLabel}</Link>
              ) : (
                vLabel
              )}
            </div>
          </div>
          <div>
            <div className="label">Location</div>
            <div className="value">
              {mapUrl ? (
                <a href={mapUrl} target="_blank" rel="noreferrer">
                  Open in Maps
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="label">Downtime</div>
            <div className="value">{formatDowntime(downtimeMs(b))}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Timeline</h2>
        <table className="list-table">
          <tbody>
            {STEPS.map((s) => {
              const ts = b[s.col] as string | null;
              return (
                <tr key={s.key}>
                  <td style={{ width: 180 }}>{s.label}</td>
                  <td className={ts ? "ok" : "muted"}>
                    {ts ? fmtDateTime(ts) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {canManage && next && (
          <div className="btn-row">
            <ConfirmButton
              action={advanceBreakdown.bind(null, id, stage)}
              label={`Mark: ${next.label}`}
              className="btn"
            />
          </div>
        )}
      </div>
    </>
  );
}
