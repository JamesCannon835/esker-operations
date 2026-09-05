import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { getMechanics } from "@/lib/assets-server";
import {
  FAULT_STATUS_LABELS,
  FAULT_SEVERITY_LABELS,
  formatDuration,
  type FaultSeverity,
} from "@/lib/inspections";
import { resolveAssetLabels, assetHref } from "@/lib/asset-labels";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { LogTimeForm } from "./log-time-form";
import { DiagnosisForm } from "./diagnosis-form";
import { AddPartForm } from "./add-part-form";
import {
  acceptFault,
  assignFault,
  setFaultStatus,
  closeFault,
  reopenFault,
  logTime,
  deleteLabour,
  deletePart,
  voidFault,
} from "./actions";
import { openReportForFault } from "@/app/(app)/maintenance/actions";

export const dynamic = "force-dynamic";

function euro(n: number | null | undefined) {
  if (n == null) return "—";
  return `€${Number(n).toFixed(2)}`;
}

export default async function FaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, roles } = await requireUser();
  const supabase = await createClient();

  const { data: fault } = await supabase
    .from("faults")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!fault) notFound();

  const manager = isManager(roles);
  const mechanic = hasRole(roles, "mechanic");
  const canWork = manager || mechanic;
  const isClosed = fault.status === "closed";
  const isVehicleFault = fault.asset_type === "vehicle";

  const [{ data: reporter }, { data: assignee }, labels] = await Promise.all([
    fault.reported_by
      ? supabase.from("users").select("full_name").eq("id", fault.reported_by).maybeSingle()
      : Promise.resolve({ data: null }),
    fault.assigned_mechanic_id
      ? supabase
          .from("users")
          .select("full_name")
          .eq("id", fault.assigned_mechanic_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    resolveAssetLabels([fault]),
  ]);

  const assetLabel = labels.get(`${fault.asset_type}:${fault.asset_id}`) ?? "—";
  const href = assetHref(fault.asset_type, fault.asset_id);

  // Labour + parts (RLS: mechanic sees own labour, manager sees all)
  const [{ data: labour }, { data: parts }, mechanics] = await Promise.all([
    canWork
      ? supabase
          .from("labour_entries")
          .select("id, mechanic_id, start_time, stop_time, entry_type")
          .eq("fault_id", id)
          .order("start_time")
      : Promise.resolve({ data: [] }),
    canWork
      ? supabase
          .from("parts_used")
          .select("id, part_name, part_number, quantity, unit_cost, supplier, total_cost")
          .eq("fault_id", id)
          .order("id")
      : Promise.resolve({ data: [] }),
    manager ? getMechanics() : Promise.resolve([]),
  ]);

  const labourRows = labour ?? [];
  const partRows = parts ?? [];

  const labourNames = new Map<string, string>();
  if (manager) {
    const ids = [...new Set(labourRows.map((l) => l.mechanic_id).filter(Boolean))];
    if (ids.length) {
      const { data } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", ids as string[]);
      for (const p of data ?? []) labourNames.set(p.id, p.full_name);
    }
  }

  const totalLabourMs = labourRows
    .filter((l) => l.stop_time)
    .reduce(
      (acc, l) =>
        acc + (new Date(l.stop_time!).getTime() - new Date(l.start_time).getTime()),
      0,
    );

  const totalParts = partRows.reduce(
    (acc, p) => acc + Number(p.total_cost ?? 0),
    0,
  );

  const { data: linkedReport } =
    fault.asset_type === "vehicle"
      ? await supabase
          .from("maintenance_reports")
          .select("id, status, report_number")
          .eq("fault_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  return (
    <>
      <Link className="link-back" href="/faults">
        ← Faults
      </Link>
      <div className="page-head">
        <h1>Fault — {assetLabel}</h1>
        <span className={`severity-pill ${fault.severity}`}>
          {FAULT_SEVERITY_LABELS[fault.severity as FaultSeverity] ?? fault.severity}
        </span>
      </div>

      {!fault.safe_to_operate && (
        <div className="voided-banner">Reported as NOT safe to operate.</div>
      )}

      <div className="card">
        <h2>{fault.description}</h2>
        <div className="detail-grid" style={{ marginTop: 12 }}>
          <div>
            <div className="label">Status</div>
            <div className="value">
              <span className="badge">
                {FAULT_STATUS_LABELS[fault.status] ?? fault.status}
              </span>
            </div>
          </div>
          <div>
            <div className="label">Reported</div>
            <div className="value">
              {fmtDateTime(fault.reported_at)} ·{" "}
              {(reporter as { full_name?: string } | null)?.full_name ?? "—"}
            </div>
          </div>
          <div>
            <div className="label">Category</div>
            <div className="value">{fault.category ?? "—"}</div>
          </div>
          <div>
            <div className="label">Location</div>
            <div className="value">{fault.location ?? "—"}</div>
          </div>
          <div>
            <div className="label">Asset</div>
            <div className="value">
              {href ? <Link href={href}>{assetLabel}</Link> : assetLabel}
            </div>
          </div>
          {fault.source_inspection_id && (
            <div>
              <div className="label">From inspection</div>
              <div className="value">
                <Link href={`/inspections/${fault.source_inspection_id}`}>
                  View inspection
                </Link>
              </div>
            </div>
          )}
          {isClosed && (
            <div>
              <div className="label">Closed</div>
              <div className="value">{fmtDateTime(fault.closed_at)}</div>
            </div>
          )}
        </div>
      </div>

      {canWork && fault.asset_type === "vehicle" && (
        <div className="card">
          <h2>Maintenance report</h2>
          {linkedReport ? (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                {linkedReport.status === "draft"
                  ? "This fault closes when the report is completed."
                  : `Closed off on ${linkedReport.report_number ?? "the report"}.`}
              </p>
              <Link className="btn" href={`/maintenance/${linkedReport.id}`}>
                {linkedReport.status === "draft"
                  ? "Continue maintenance report"
                  : `View ${linkedReport.report_number ?? "report"}`}
              </Link>
            </>
          ) : (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                Fill out a maintenance report to record the work and close this
                fault — jobs, parts, labour, vehicle status, sign-off. This is
                the only way a fault is fixed.
              </p>
              <form action={openReportForFault.bind(null, id)}>
                <button className="btn" type="submit">
                  Create maintenance report
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {canWork && !isVehicleFault && !isClosed && (
        <div className="card">
          <p className="hint" style={{ margin: 0 }}>
            Maintenance reports cover vehicles. For plant and trailers, log the
            diagnosis, time and parts below, then use <em>Close job</em> in the
            Status section.
          </p>
        </div>
      )}

      {canWork && isClosed && (
        <div className="card">
          <p className="hint" style={{ margin: 0 }}>
            This fault is closed
            {fault.closed_at ? ` (${fmtDateTime(fault.closed_at)})` : ""}.
            {manager ? " Use “Reopen job” below if it needs more work." : ""}
          </p>
        </div>
      )}

      {!canWork && (
        <div className="card">
          <p className="hint">
            A mechanic or manager will pick this up. You&apos;ll see progress
            here.
          </p>
        </div>
      )}

      {canWork && (
        <>
          <div className="card">
            <h2>Assignment</h2>
            <p>
              Assigned to:{" "}
              <strong>
                {(assignee as { full_name?: string } | null)?.full_name ??
                  "Unassigned"}
              </strong>
            </p>
            {!isClosed && !fault.assigned_mechanic_id && mechanic && (
              <ConfirmButton
                action={acceptFault.bind(null, id)}
                label="Accept this job"
                className="btn"
              />
            )}
            {!isClosed && manager && (
              <form
                action={assignFault.bind(null, id)}
                style={{ display: "flex", gap: 8, marginTop: 10 }}
              >
                <select
                  name="mechanic_id"
                  defaultValue={fault.assigned_mechanic_id ?? ""}
                >
                  <option value="">— Unassigned —</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
                <button className="btn ghost" type="submit">
                  Set
                </button>
              </form>
            )}
          </div>

          <div className="card">
            <h2>Diagnosis</h2>
            {mechanic && !isClosed ? (
              <DiagnosisForm faultId={id} defaultValue={fault.diagnosis} />
            ) : (
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {fault.diagnosis || "—"}
              </p>
            )}
          </div>

          <div className="card">
            <h2>Job time</h2>
            {mechanic && !isClosed && (
              <div style={{ marginBottom: 14 }}>
                <LogTimeForm action={logTime.bind(null, id)} />
              </div>
            )}
            {labourRows.length === 0 ? (
              <p className="hint">No time logged yet.</p>
            ) : (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {manager && <th>Mechanic</th>}
                    <th>Time</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {labourRows.map((l) => {
                    const dur = l.stop_time
                      ? formatDuration(
                          new Date(l.stop_time).getTime() -
                            new Date(l.start_time).getTime(),
                        )
                      : "—";
                    const mine = l.mechanic_id === user.id;
                    return (
                      <tr key={l.id}>
                        <td className="muted">{fmtDate(l.start_time)}</td>
                        {manager && (
                          <td className="muted">
                            {labourNames.get(l.mechanic_id ?? "") ?? "—"}
                          </td>
                        )}
                        <td>{dur}</td>
                        <td>
                          {!isClosed && (manager || mine) && (
                            <ConfirmButton
                              action={deleteLabour.bind(null, id, l.id)}
                              label="Delete"
                              className="btn ghost small"
                              confirmText="Delete this time entry?"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="hint" style={{ marginTop: 8 }}>
              Total logged time: <strong>{formatDuration(totalLabourMs)}</strong>
              {mechanic && !manager && " (your entries)"}
            </p>
          </div>

          <div className="card">
            <h2>Parts</h2>
            {partRows.length === 0 ? (
              <p className="hint">No parts logged.</p>
            ) : (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Total</th>
                    <th>Supplier</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {partRows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.part_name}
                        {p.part_number && (
                          <span className="muted"> · {p.part_number}</span>
                        )}
                      </td>
                      <td>{Number(p.quantity)}</td>
                      <td className="muted">{euro(p.unit_cost)}</td>
                      <td>{euro(p.total_cost)}</td>
                      <td className="muted">{p.supplier ?? "—"}</td>
                      <td>
                        {!isClosed && (
                          <ConfirmButton
                            action={deletePart.bind(null, id, p.id)}
                            label="Delete"
                            className="btn ghost small"
                            confirmText="Remove this part line?"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {partRows.length > 0 && (
              <p className="hint" style={{ marginTop: 8 }}>
                Total parts: <strong>{euro(totalParts)}</strong>
              </p>
            )}
            {!isClosed && (
              <div style={{ marginTop: 12 }}>
                <AddPartForm faultId={id} />
              </div>
            )}
          </div>

          <div className="card">
            <h2>Status</h2>
            <p className="hint">Current: {FAULT_STATUS_LABELS[fault.status]}</p>
            <div className="btn-row" style={{ marginTop: 0 }}>
              {!isClosed && fault.status !== "in_progress" && (
                <ConfirmButton
                  action={setFaultStatus.bind(null, id, "in_progress")}
                  label="Mark in progress"
                  className="btn ghost"
                />
              )}
              {!isClosed && fault.status !== "awaiting_parts" && (
                <ConfirmButton
                  action={setFaultStatus.bind(null, id, "awaiting_parts")}
                  label="Awaiting parts"
                  className="btn ghost"
                />
              )}
              {/* Vehicle faults close only via a completed maintenance report. */}
              {!isClosed && !isVehicleFault && (
                <ConfirmButton
                  action={closeFault.bind(null, id)}
                  label="Close job"
                  className="btn"
                  confirmText="Close this job? It moves out of the open list."
                />
              )}
              {isClosed && manager && (
                <ConfirmButton
                  action={reopenFault.bind(null, id)}
                  label="Reopen job"
                  className="btn ghost"
                />
              )}
            </div>
            {!isClosed && isVehicleFault && (
              <p className="field-hint" style={{ marginTop: 10 }}>
                This fault closes when its maintenance report is completed.
              </p>
            )}
          </div>

          {manager && (
            <div className="card">
              <h2>Delete</h2>
              <p className="hint">
                Removes this fault from every list. Any linked maintenance
                report and history stays.
              </p>
              <ConfirmButton
                action={voidFault.bind(null, id)}
                label="Delete this fault"
                className="btn danger"
                confirmText="Delete this fault? It will be removed from the lists."
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
