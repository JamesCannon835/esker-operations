import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { FAULT_STATUS_LABELS } from "@/lib/inspections";
import {
  VI_SEVERITY_LABELS,
  VI_STATUS_LABELS,
} from "@/lib/vehicle-inspection";
import { ConfirmButton } from "@/components/confirm-button";
import { InspectionRunner } from "../inspection-runner";
import { ReopenInspectionForm } from "../reopen-form";
import {
  setResult,
  saveInspectionMeta,
  completeInspection,
  reopenInspection,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function VehicleInspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  const manager = isManager(roles);

  const supabase = await createClient();
  const { data: insp } = await supabase
    .from("vehicle_inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!insp) notFound();

  const [{ data: results }, { data: vehicle }, { data: inspector }] =
    await Promise.all([
      supabase
        .from("vehicle_inspection_results")
        .select("*")
        .eq("inspection_id", id)
        .order("sort_order"),
      supabase.from("vehicles").select("*").eq("id", insp.vehicle_id).maybeSingle(),
      insp.inspector_id
        ? supabase
            .from("users")
            .select("full_name")
            .eq("id", insp.inspector_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const rows = results ?? [];
  const draft = insp.status === "draft";
  const vLabel = vehicle
    ? vehicleName(vehicle.fleet_number, vehicle.registration)
    : "Vehicle";

  // fault statuses for the defects (read-only view)
  const faultIds = rows
    .map((r) => r.fault_id)
    .filter(Boolean) as string[];
  const faultStatus = new Map<string, string>();
  if (faultIds.length) {
    const { data: fs } = await supabase
      .from("faults")
      .select("id, status")
      .in("id", faultIds);
    for (const f of fs ?? []) faultStatus.set(f.id, f.status);
  }

  return (
    <>
      <Link className="link-back" href="/vehicle-inspections">
        ← Inspections
      </Link>
      <div className="page-head">
        <h1>
          {insp.inspection_number ?? "Vehicle inspection — draft"}
        </h1>
        <span
          className={
            insp.result === "out_of_service"
              ? "severity-pill critical"
              : "badge"
          }
        >
          {draft
            ? "In progress"
            : VI_STATUS_LABELS[insp.result] ?? "Completed"}
        </span>
      </div>

      {!draft && insp.out_of_service && (
        <div className="voided-banner">
          Vehicle OUT OF SERVICE — a defect on this inspection is not safe to
          operate. Returns to service automatically when the fault is closed.
        </div>
      )}

      <div className="card">
        <h2>Vehicle</h2>
        <div className="detail-grid">
          <div>
            <div className="label">Registration</div>
            <div className="value">
              {vehicle ? (
                <Link href={`/vehicles/${vehicle.id}`}>{vLabel}</Link>
              ) : (
                vLabel
              )}
            </div>
          </div>
          <div>
            <div className="label">Make / model</div>
            <div className="value">
              {[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "—"}
            </div>
          </div>
          <div>
            <div className="label">Odometer</div>
            <div className="value">
              {insp.odometer != null
                ? `${Number(insp.odometer).toLocaleString()} km`
                : "—"}
            </div>
          </div>
          <div>
            <div className="label">Date / time</div>
            <div className="value">
              {fmtDate(insp.inspection_date)}
              {insp.inspection_time ? ` · ${insp.inspection_time}` : ""}
            </div>
          </div>
          <div>
            <div className="label">Inspector</div>
            <div className="value">
              {(inspector as { full_name?: string } | null)?.full_name ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {draft ? (
        <InspectionRunner
          inspectionId={id}
          items={rows.map((r) => ({
            id: r.id,
            section: r.section,
            reference_code: r.reference_code,
            item_name: r.item_name,
            result: r.result,
            defect_description: r.defect_description,
            severity: r.severity,
            safe_to_operate: r.safe_to_operate,
            photo_path: r.photo_path,
          }))}
          meta={{
            service_done: insp.service_done,
            service_notes: insp.service_notes,
            notes: insp.notes,
            signature_confirmed: insp.signature_confirmed,
          }}
          setResult={setResult.bind(null, id)}
          saveMeta={saveInspectionMeta.bind(null, id)}
          complete={completeInspection.bind(null, id)}
        />
      ) : (
        <ReadOnly
          rows={rows}
          faultStatus={faultStatus}
          serviceDone={insp.service_done}
          serviceNotes={insp.service_notes}
          notes={insp.notes}
          completedAt={insp.completed_at}
          inspectorName={
            (inspector as { full_name?: string } | null)?.full_name ?? "the inspector"
          }
          reopened={insp.reopened_count}
        />
      )}

      {!draft && manager && (
        <div className="card">
          <h2>Reopen</h2>
          <ReopenInspectionForm action={reopenInspection.bind(null, id)} />
        </div>
      )}
    </>
  );
}

type ResultRow = {
  id: string;
  section: string;
  reference_code: string | null;
  item_name: string;
  result: string | null;
  defect_description: string | null;
  severity: string | null;
  safe_to_operate: boolean | null;
  fault_id: string | null;
  photo_path: string | null;
};

function ReadOnly({
  rows,
  faultStatus,
  serviceDone,
  serviceNotes,
  notes,
  completedAt,
  inspectorName,
  reopened,
}: {
  rows: ResultRow[];
  faultStatus: Map<string, string>;
  serviceDone: boolean;
  serviceNotes: string | null;
  notes: string | null;
  completedAt: string | null;
  inspectorName: string;
  reopened: number;
}) {
  const sections = [...new Set(rows.map((r) => r.section))];
  const defects = rows.filter((r) => r.result === "defect");

  return (
    <>
      {defects.length > 0 && (
        <div className="card">
          <h2>Defects ({defects.length})</h2>
          <table className="list-table">
            <tbody>
              {defects.map((d) => {
                const st = d.fault_id ? faultStatus.get(d.fault_id) : undefined;
                const rectified = st === "closed";
                return (
                  <tr key={d.id}>
                    <td>
                      {d.reference_code ? `${d.reference_code} — ` : ""}
                      {d.item_name}
                      <div className="muted" style={{ fontSize: 13 }}>
                        {d.defect_description}
                      </div>
                    </td>
                    <td>
                      {d.severity
                        ? VI_SEVERITY_LABELS[
                            d.severity as keyof typeof VI_SEVERITY_LABELS
                          ]
                        : "—"}
                      {d.safe_to_operate === false && (
                        <div className="blocked" style={{ fontSize: 13 }}>
                          Not safe
                        </div>
                      )}
                    </td>
                    <td>
                      {d.photo_path && (
                        <a
                          href={`/vehicle-inspections/result/${d.id}/photo`}
                          target="_blank"
                          rel="noopener"
                        >
                          Photo
                        </a>
                      )}
                    </td>
                    <td>
                      {d.fault_id ? (
                        <Link href={`/faults/${d.fault_id}`}>
                          {rectified ? (
                            <span className="ok">Rectified</span>
                          ) : (
                            <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                              {FAULT_STATUS_LABELS[st ?? ""] ?? "Open"}
                            </span>
                          )}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>All items</h2>
        {sections.map((s) => (
          <div key={s} style={{ marginBottom: 14 }}>
            <h3 className="sec">{s}</h3>
            <table className="list-table">
              <tbody>
                {rows
                  .filter((r) => r.section === s)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.reference_code ? `${r.reference_code} — ` : ""}
                        {r.item_name}
                      </td>
                      <td style={{ width: 80 }}>
                        {r.result === "defect" ? (
                          <span className="blocked">DEFECT</span>
                        ) : r.result === "na" ? (
                          <span className="muted">N/A</span>
                        ) : (
                          <span className="ok">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}

        {serviceDone && (
          <p className="hint">
            Service carried out during this inspection
            {serviceNotes ? ` — ${serviceNotes}` : ""}.
          </p>
        )}
        {notes && (
          <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{notes}</p>
        )}
        {completedAt && (
          <p className="hint" style={{ marginTop: 12 }}>
            Signed off {fmtDateTime(completedAt)} by {inspectorName}.
            {reopened > 0 ? ` Reopened ${reopened}×.` : ""}
          </p>
        )}
      </div>
    </>
  );
}
