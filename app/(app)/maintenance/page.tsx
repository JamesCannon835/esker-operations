import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import { fmtDate } from "@/lib/format";
import {
  MR_VEHICLE_STATUS_LABELS,
  MR_OUT_OF_SERVICE,
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
  followup_required: boolean;
  followup_action_id: string | null;
  created_by: string | null;
};

export default async function MaintenanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { roles } = await requireUser();
  const workshop = hasRole(roles, "mechanic") || isManager(roles);
  if (!workshop) redirect("/dashboard");
  const manager = isManager(roles);

  const { show } = await searchParams;
  const filter = show ?? "open";

  const supabase = await createClient();
  let q = supabase
    .from("maintenance_reports")
    .select(
      "id, report_number, vehicle_id, report_date, mileage, status, vehicle_status, followup_required, followup_action_id, created_by",
    )
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "drafts") q = q.eq("status", "draft");
  else if (filter === "oos") q = q.in("vehicle_status", MR_OUT_OF_SERVICE);
  else if (filter === "followup") q = q.eq("followup_required", true);
  // "all" = no extra filter; "open" handled after fetch (needs action status)

  const { data, error } = await q;
  let rows = (data ?? []) as Row[];

  // resolve linked follow-up actions still open
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
        (r.vehicle_status && MR_OUT_OF_SERVICE.includes(r.vehicle_status as MrVehicleStatus)),
    );
  }

  const vIds = [...new Set(rows.map((r) => r.vehicle_id))];
  const vMap = new Map<string, string>();
  if (vIds.length) {
    const { data: vs } = await supabase
      .from("vehicles")
      .select("id, fleet_number, registration")
      .in("id", vIds);
    for (const v of vs ?? [])
      vMap.set(v.id, vehicleName(v.fleet_number, v.registration));
  }
  const uIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const uMap = new Map<string, string>();
  if (uIds.length) {
    const { data: us } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", uIds);
    for (const u of us ?? []) uMap.set(u.id, u.full_name);
  }

  const TABS = [
    { key: "open", label: "Needs attention" },
    { key: "drafts", label: "Drafts" },
    { key: "followup", label: "Follow-up" },
    { key: "oos", label: "Out of service" },
    { key: "all", label: "All" },
  ];

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
            href={`/maintenance?show=${t.key}`}
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

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No reports here.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Mileage</th>
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
                    r.followup_action_id && openActions.has(r.followup_action_id);
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
                        {r.mileage != null
                          ? `${Number(r.mileage).toLocaleString()} km`
                          : "—"}
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
                          <span className="blocked">Draft</span>
                        ) : followOpen ? (
                          <span style={{ color: "var(--amber)", fontWeight: 600 }}>
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
