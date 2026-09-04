import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getMechanics } from "@/lib/assets-server";
import { vehicleName } from "@/lib/asset-name";
import { fmtDate } from "@/lib/format";
import {
  MR_REASONS,
  MR_REASON_LABELS,
  MR_VEHICLE_STATUS_LABELS,
  MR_OUT_OF_SERVICE,
  type MrReason,
  type MrVehicleStatus,
} from "@/lib/maintenance";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  report_number: string | null;
  vehicle_id: string;
  report_date: string;
  mileage: number | null;
  status: string;
  vehicle_status: string | null;
  reasons: string[];
  followup_required: boolean;
  followup_action_id: string | null;
  created_by: string | null;
};

type SP = {
  show?: string;
  vehicle?: string;
  mechanic?: string;
  reason?: string;
  from?: string;
  to?: string;
};

export default async function MaintenanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { roles } = await requireUser();
  const workshop = hasRole(roles, "mechanic") || isManager(roles);
  if (!workshop) redirect("/dashboard");
  const manager = isManager(roles);

  const sp = await searchParams;
  const filter = sp.show ?? "open";

  const supabase = await createClient();
  let q = supabase
    .from("maintenance_reports")
    .select(
      "id, report_number, vehicle_id, report_date, mileage, status, vehicle_status, reasons, followup_required, followup_action_id, created_by",
    )
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (filter === "drafts") q = q.eq("status", "draft");
  else if (filter === "oos") q = q.in("vehicle_status", MR_OUT_OF_SERVICE);
  else if (filter === "followup") q = q.eq("followup_required", true);

  if (sp.vehicle) q = q.eq("vehicle_id", sp.vehicle);
  if (sp.mechanic) q = q.eq("created_by", sp.mechanic);
  if (sp.reason) q = q.contains("reasons", [sp.reason]);
  if (sp.from) q = q.gte("report_date", sp.from);
  if (sp.to) q = q.lte("report_date", sp.to);

  const [{ data, error }, { data: vehicles }, mechanics] = await Promise.all([
    q,
    supabase
      .from("vehicles")
      .select("id, fleet_number, registration")
      .eq("voided", false)
      .order("registration"),
    getMechanics(),
  ]);
  let rows = (data ?? []) as Row[];

  const actionIds = rows
    .map((r) => r.followup_action_id)
    .filter(Boolean) as string[];
  const openActions = new Set<string>();
  if (actionIds.length) {
    const { data: acts } = await supabase
      .from("actions")
      .select("id, status")
      .in("id", actionIds);
    for (const a of acts ?? [])
      if (a.status !== "done" && a.status !== "cancelled") openActions.add(a.id);
  }

  if (filter === "open") {
    rows = rows.filter(
      (r) =>
        r.status === "draft" ||
        (r.followup_action_id && openActions.has(r.followup_action_id)) ||
        (r.vehicle_status &&
          MR_OUT_OF_SERVICE.includes(r.vehicle_status as MrVehicleStatus)),
    );
  }

  const vMap = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      vehicleName(v.fleet_number, v.registration),
    ]),
  );
  const uMap = new Map(mechanics.map((m) => [m.id, m.full_name]));

  const TABS = [
    { key: "open", label: "Needs attention" },
    { key: "drafts", label: "Drafts" },
    { key: "followup", label: "Follow-up" },
    { key: "oos", label: "Out of service" },
    { key: "all", label: "All" },
  ];

  const keep = (extra: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/maintenance?${p.toString()}`;
  };

  return (
    <>
      <div className="page-head">
        <h1>Maintenance reports</h1>
        <Link className="btn small" href="/maintenance/new">
          + New report
        </Link>
      </div>

      <div className="nav-inner" style={{ padding: 0, marginBottom: 14 }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={keep({ show: t.key })}
            className="btn ghost small"
            style={
              filter === t.key
                ? { background: "var(--brand)", color: "#fff" }
                : undefined
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {manager && (
        <form method="get" className="card" style={{ marginBottom: 14 }}>
          <input type="hidden" name="show" value={filter} />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="f-veh">Vehicle</label>
              <select id="f-veh" name="vehicle" defaultValue={sp.vehicle ?? ""}>
                <option value="">All</option>
                {(vehicles ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleName(v.fleet_number, v.registration)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-mech">Mechanic</label>
              <select
                id="f-mech"
                name="mechanic"
                defaultValue={sp.mechanic ?? ""}
              >
                <option value="">All</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-reason">Reason</label>
              <select id="f-reason" name="reason" defaultValue={sp.reason ?? ""}>
                <option value="">All</option>
                {MR_REASONS.map((rz) => (
                  <option key={rz} value={rz}>
                    {MR_REASON_LABELS[rz]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-from">From</label>
              <input
                id="f-from"
                name="from"
                type="date"
                defaultValue={sp.from ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="f-to">To</label>
              <input
                id="f-to"
                name="to"
                type="date"
                defaultValue={sp.to ?? ""}
              />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn small" type="submit">
              Apply
            </button>
            <Link className="btn ghost small" href={`/maintenance?show=${filter}`}>
              Clear
            </Link>
          </div>
        </form>
      )}

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No reports match.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Reason</th>
                  {manager && <th>Mechanic</th>}
                  <th>Vehicle status</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const oos =
                    r.vehicle_status &&
                    MR_OUT_OF_SERVICE.includes(
                      r.vehicle_status as MrVehicleStatus,
                    );
                  const followOpen =
                    r.followup_action_id &&
                    openActions.has(r.followup_action_id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/maintenance/${r.id}`}>
                          {r.report_number ?? "Draft"}
                        </Link>
                      </td>
                      <td className="muted">{fmtDate(r.report_date)}</td>
                      <td className="muted">{vMap.get(r.vehicle_id) ?? "—"}</td>
                      <td className="muted">
                        {(r.reasons ?? [])
                          .map(
                            (x: string) =>
                              MR_REASON_LABELS[x as MrReason] ?? x,
                          )
                          .join(", ") || "—"}
                      </td>
                      {manager && (
                        <td className="muted">
                          {uMap.get(r.created_by ?? "") ?? "—"}
                        </td>
                      )}
                      <td>
                        <span className={oos ? "blocked" : undefined}>
                          {r.vehicle_status
                            ? MR_VEHICLE_STATUS_LABELS[
                                r.vehicle_status as MrVehicleStatus
                              ]
                            : "—"}
                        </span>
                      </td>
                      <td className="muted">
                        {r.status === "draft" ? (
                          <span className="badge">Draft</span>
                        ) : followOpen ? (
                          <span
                            style={{ color: "var(--amber)", fontWeight: 600 }}
                          >
                            Follow-up outstanding
                          </span>
                        ) : (
                          "Completed"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
