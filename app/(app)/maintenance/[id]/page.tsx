import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getMechanics } from "@/lib/assets-server";
import { vehicleName } from "@/lib/asset-name";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { FAULT_SEVERITY_LABELS, type FaultSeverity } from "@/lib/inspections";
import {
  MR_REASON_LABELS,
  MR_VEHICLE_STATUS_LABELS,
  MR_OUT_OF_SERVICE,
  WORK_CATEGORIES,
  minutesToHm,
  type MrReason,
  type MrVehicleStatus,
} from "@/lib/maintenance";
import { ConfirmButton } from "@/components/confirm-button";
import { ReportEditor } from "../report-editor";
import { CompleteButton, ReopenForm } from "../complete-button";
import {
  saveReportFields,
  completeReport,
  reopenReport,
  addWorkItem,
  removeWorkItem,
  addPart,
  removePart,
  addLabour,
  removeLabour,
} from "../actions";

export const dynamic = "force-dynamic";

const HOURS = Array.from({ length: 13 }, (_, i) => i);
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default async function MaintenanceReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  const manager = isManager(roles);

  const supabase = await createClient();
  const { data: r } = await supabase
    .from("maintenance_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const [
    { data: vehicle },
    { data: fault },
    { data: workItems },
    { data: parts },
    { data: labour },
    { data: followAction },
    mechanics,
    { data: people },
  ] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", r.vehicle_id).maybeSingle(),
    r.fault_id
      ? supabase
          .from("faults")
          .select(
            "id, description, severity, reported_at, reported_by, safe_to_operate, photo_url",
          )
          .eq("id", r.fault_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("maintenance_work_items")
      .select("*")
      .eq("report_id", id)
      .order("created_at"),
    supabase
      .from("maintenance_parts")
      .select("*")
      .eq("report_id", id)
      .order("created_at"),
    supabase
      .from("maintenance_labour")
      .select("*")
      .eq("report_id", id)
      .order("created_at"),
    r.followup_action_id
      ? supabase
          .from("actions")
          .select("id, status, due_date")
          .eq("id", r.followup_action_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getMechanics(),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name"),
  ]);

  const draft = r.status === "draft";
  const editable = draft && (hasRole(roles, "mechanic") || manager);

  const reporter =
    fault?.reported_by &&
    (
      await supabase
        .from("users")
        .select("full_name")
        .eq("id", fault.reported_by)
        .maybeSingle()
    ).data?.full_name;

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const totalLabourMin = (labour ?? []).reduce((a, l) => a + (l.minutes ?? 0), 0);
  const totalParts = (parts ?? []).reduce(
    (a, p) => a + Number(p.total_cost ?? 0),
    0,
  );
  const followOpen =
    followAction &&
    followAction.status !== "done" &&
    followAction.status !== "cancelled";
  const oos =
    r.vehicle_status &&
    MR_OUT_OF_SERVICE.includes(r.vehicle_status as MrVehicleStatus);

  const vLabel = vehicle
    ? vehicleName(vehicle.fleet_number, vehicle.registration)
    : "Vehicle";
  const showEngineHours = !!vehicle?.current_hours;

  return (
    <>
      <Link
        className="link-back"
        href={r.fault_id ? `/faults/${r.fault_id}` : "/maintenance"}
      >
        ← {r.fault_id ? "Fault" : "Maintenance reports"}
      </Link>

      <div className="page-head">
        <h1>{r.report_number ?? "Maintenance report — draft"}</h1>
        {oos ? (
          <span className="severity-pill critical">OUT OF SERVICE</span>
        ) : draft ? (
          <span className="badge">Draft</span>
        ) : (
          <span className="badge">Completed</span>
        )}
      </div>

      {!draft && followOpen && (
        <div className="voided-banner">
          Follow-up outstanding
          {followAction?.due_date
            ? ` — due ${fmtDate(followAction.due_date)}`
            : ""}
          .{" "}
          <Link href={`/actions/${followAction!.id}`} style={{ color: "inherit" }}>
            Open action →
          </Link>
        </div>
      )}

      {/* --- vehicle details --- */}
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
            <div className="label">Date</div>
            <div className="value">
              {fmtDate(r.report_date)}
              {r.report_time ? ` · ${r.report_time}` : ""}
            </div>
          </div>
          <div>
            <div className="label">Mechanic</div>
            <div className="value">
              {nameById.get(r.created_by ?? "") ?? "—"}
            </div>
          </div>
          {!draft && (
            <>
              <div>
                <div className="label">Mileage</div>
                <div className="value">
                  {r.mileage != null
                    ? `${Number(r.mileage).toLocaleString()} km`
                    : "—"}
                </div>
              </div>
              {showEngineHours && (
                <div>
                  <div className="label">Engine hours</div>
                  <div className="value">{r.engine_hours ?? "—"}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- linked fault --- */}
      {fault && (
        <div className="card">
          <h2>Linked fault</h2>
          {!fault.safe_to_operate && (
            <div className="voided-banner">
              Driver reported this as NOT safe to operate.
            </div>
          )}
          <p style={{ fontWeight: 600, marginBottom: 6 }}>{fault.description}</p>
          <p className="hint" style={{ margin: 0 }}>
            Reported {fmtDateTime(fault.reported_at)}
            {reporter ? ` by ${reporter}` : ""} ·{" "}
            {FAULT_SEVERITY_LABELS[fault.severity as FaultSeverity] ??
              fault.severity}{" "}
            · <Link href={`/faults/${fault.id}`}>Open fault</Link>
          </p>
          {fault.photo_url && (
            <p className="hint" style={{ marginTop: 6 }}>
              <a href={fault.photo_url} target="_blank" rel="noopener">
                View reported photo
              </a>
            </p>
          )}
        </div>
      )}

      {editable ? (
        <div className="card">
          <ReportEditor
            fields={{
              report_time: r.report_time,
              mileage: r.mileage,
              engine_hours: r.engine_hours,
              reasons: r.reasons ?? [],
              issue_description: r.issue_description,
              work_summary: r.work_summary,
              notes: r.notes,
              vehicle_status: r.vehicle_status,
              signature_confirmed: r.signature_confirmed,
              followup_required: r.followup_required,
              followup_detail: r.followup_detail,
              followup_priority: r.followup_priority,
              followup_assigned_to: r.followup_assigned_to,
              followup_due_date: r.followup_due_date,
            }}
            people={people ?? []}
            showEngineHours={showEngineHours}
            save={saveReportFields.bind(null, id)}
          >
            {/* --- jobs done --- */}
            <h3 className="sec">Jobs done</h3>
            {(workItems ?? []).length > 0 && (
              <ul className="mr-items">
                {(workItems ?? []).map((w) => (
                  <li key={w.id}>
                    <span>
                      {w.completed ? "✓" : "○"} {w.description}
                      {w.category ? ` · ${w.category}` : ""}
                      {w.labour_minutes
                        ? ` · ${minutesToHm(w.labour_minutes)}`
                        : ""}
                    </span>
                    <ConfirmButton
                      action={removeWorkItem.bind(null, id, w.id)}
                      label="✕"
                      className="btn ghost small"
                    />
                  </li>
                ))}
              </ul>
            )}
            <form action={addWorkItem.bind(null, id)} className="mr-add">
              <input name="description" placeholder="e.g. Replace front brake pads" />
              <select name="category" defaultValue="">
                <option value="">Category…</option>
                {WORK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button className="btn ghost small" type="submit">
                Add job
              </button>
            </form>

            {/* --- parts --- */}
            <h3 className="sec">Parts used</h3>
            {(parts ?? []).length > 0 && (
              <ul className="mr-items">
                {(parts ?? []).map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.quantity}× {p.description}
                      {p.part_number ? ` (${p.part_number})` : ""}
                      {p.supplier ? ` · ${p.supplier}` : ""}
                      {p.unit_cost != null
                        ? ` · ${fmtMoney(p.total_cost)}`
                        : ""}
                    </span>
                    <ConfirmButton
                      action={removePart.bind(null, id, p.id)}
                      label="✕"
                      className="btn ghost small"
                    />
                  </li>
                ))}
              </ul>
            )}
            <form action={addPart.bind(null, id)} className="mr-add">
              <input name="description" placeholder="Part description" />
              <input name="part_number" placeholder="Part no." />
              <input
                name="quantity"
                type="number"
                inputMode="numeric"
                defaultValue="1"
                style={{ width: 64 }}
              />
              <input name="supplier" placeholder="Supplier" />
              <input
                name="unit_cost"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="€ each"
                style={{ width: 90 }}
              />
              <button className="btn ghost small" type="submit">
                Add part
              </button>
            </form>

            {/* --- labour --- */}
            <h3 className="sec">Mechanic labour</h3>
            {(labour ?? []).length > 0 && (
              <ul className="mr-items">
                {(labour ?? []).map((l) => (
                  <li key={l.id}>
                    <span>
                      {nameById.get(l.mechanic_id ?? "") ?? "Mechanic"} —{" "}
                      {minutesToHm(l.minutes)} · {fmtDate(l.work_date)}
                    </span>
                    <ConfirmButton
                      action={removeLabour.bind(null, id, l.id)}
                      label="✕"
                      className="btn ghost small"
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="hint" style={{ margin: "4px 0 8px" }}>
              Total: <strong>{minutesToHm(totalLabourMin)}</strong>
            </p>
            <form action={addLabour.bind(null, id)} className="mr-add">
              <select name="mechanic_id" defaultValue={user.id}>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
              <select name="hours" defaultValue="0">
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
              <select name="minutes" defaultValue="0">
                {MINS.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}m
                  </option>
                ))}
              </select>
              <button className="btn ghost small" type="submit">
                Add time
              </button>
            </form>
          </ReportEditor>

          <div style={{ marginTop: 20 }}>
            <CompleteButton action={completeReport.bind(null, id)} />
          </div>
        </div>
      ) : (
        <ReadOnly
          r={r}
          workItems={workItems ?? []}
          parts={parts ?? []}
          labour={labour ?? []}
          nameById={nameById}
          totalLabourMin={totalLabourMin}
          totalParts={totalParts}
        />
      )}

      {!draft && manager && (
        <div className="card">
          <h2>Reopen</h2>
          <ReopenForm action={reopenReport.bind(null, id)} />
        </div>
      )}
    </>
  );
}

/* ---------- read-only view of a completed report ---------- */
function ReadOnly({
  r,
  workItems,
  parts,
  labour,
  nameById,
  totalLabourMin,
  totalParts,
}: {
  r: Record<string, unknown>;
  workItems: { id: string; description: string; completed: boolean; category: string | null; labour_minutes: number | null }[];
  parts: { id: string; description: string; quantity: number; part_number: string | null; supplier: string | null; unit_cost: number | null; total_cost: number | null }[];
  labour: { id: string; mechanic_id: string | null; minutes: number; work_date: string }[];
  nameById: Map<string, string>;
  totalLabourMin: number;
  totalParts: number;
}) {
  const reasons = (r.reasons as string[]) ?? [];
  const vs = r.vehicle_status as MrVehicleStatus | null;
  return (
    <div className="card">
      {reasons.length > 0 && (
        <>
          <h3 className="sec">Reason</h3>
          <p>{reasons.map((x) => MR_REASON_LABELS[x as MrReason] ?? x).join(", ")}</p>
        </>
      )}
      {r.issue_description ? (
        <>
          <h3 className="sec">Fault / issue reported</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.issue_description as string}</p>
        </>
      ) : null}

      <h3 className="sec">Work carried out</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{(r.work_summary as string) || "—"}</p>

      {workItems.length > 0 && (
        <ul className="mr-items">
          {workItems.map((w) => (
            <li key={w.id}>
              <span>
                {w.completed ? "✓" : "○"} {w.description}
                {w.category ? ` · ${w.category}` : ""}
                {w.labour_minutes ? ` · ${minutesToHm(w.labour_minutes)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {parts.length > 0 && (
        <>
          <h3 className="sec">Parts used</h3>
          <ul className="mr-items">
            {parts.map((p) => (
              <li key={p.id}>
                <span>
                  {p.quantity}× {p.description}
                  {p.part_number ? ` (${p.part_number})` : ""}
                  {p.supplier ? ` · ${p.supplier}` : ""}
                  {p.unit_cost != null ? ` · ${fmtMoney(p.total_cost)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Parts total: {fmtMoney(totalParts)}</p>
        </>
      )}

      <h3 className="sec">Labour</h3>
      <ul className="mr-items">
        {labour.map((l) => (
          <li key={l.id}>
            <span>
              {nameById.get(l.mechanic_id ?? "") ?? "Mechanic"} —{" "}
              {minutesToHm(l.minutes)} · {fmtDate(l.work_date)}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">Total labour: {minutesToHm(totalLabourMin)}</p>

      {r.notes ? (
        <>
          <h3 className="sec">Notes</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.notes as string}</p>
        </>
      ) : null}

      <h3 className="sec">Vehicle status after repair</h3>
      <p className={vs && MR_OUT_OF_SERVICE.includes(vs) ? "blocked" : undefined}>
        {vs ? MR_VEHICLE_STATUS_LABELS[vs] : "—"}
      </p>

      {r.completed_at ? (
        <p className="hint" style={{ marginTop: 16 }}>
          Signed off {fmtDateTime(r.completed_at as string)} by{" "}
          {nameById.get((r.completed_by as string) ?? "") ?? "mechanic"}.
          {(r.reopened_count as number) > 0
            ? ` Reopened ${r.reopened_count as number}×.`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
