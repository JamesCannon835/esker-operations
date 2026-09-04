import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLabourRate } from "@/lib/settings";
import { fmtDate, fmtMoney } from "@/lib/format";
import {
  MR_REASON_LABELS,
  MR_VEHICLE_STATUS_LABELS,
  MR_OUT_OF_SERVICE,
  ACTION_OPEN,
  minutesToHm,
  type MrReason,
  type MrVehicleStatus,
  type ActionStatus,
} from "@/lib/maintenance";

/** Completed + in-progress maintenance reports for one vehicle. */
export async function VehicleMaintenanceHistory({
  vehicleId,
}: {
  vehicleId: string;
}) {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("maintenance_reports")
    .select(
      "id, report_number, report_date, mileage, reasons, work_summary, vehicle_status, status, created_by, followup_required, followup_action_id",
    )
    .eq("vehicle_id", vehicleId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = reports ?? [];
  if (rows.length === 0) {
    return (
      <div className="card">
        <h2>Maintenance history</h2>
        <p className="hint" style={{ margin: 0 }}>
          No maintenance reports for this vehicle yet.
        </p>
      </div>
    );
  }

  const ids = rows.map((r) => r.id);
  const [{ data: labour }, { data: parts }, { data: acts }, { data: people }, rate] =
    await Promise.all([
      supabase
        .from("maintenance_labour")
        .select("report_id, minutes")
        .in("report_id", ids),
      supabase
        .from("maintenance_parts")
        .select("report_id, total_cost")
        .in("report_id", ids),
      supabase
        .from("actions")
        .select("id, status")
        .in(
          "id",
          rows.map((r) => r.followup_action_id).filter(Boolean) as string[],
        ),
      supabase
        .from("users")
        .select("id, full_name")
        .in(
          "id",
          [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[],
        ),
      getLabourRate(),
    ]);

  const mins = new Map<string, number>();
  for (const l of labour ?? [])
    mins.set(l.report_id, (mins.get(l.report_id) ?? 0) + (l.minutes ?? 0));
  const partsCost = new Map<string, number>();
  for (const p of parts ?? [])
    partsCost.set(
      p.report_id,
      (partsCost.get(p.report_id) ?? 0) + Number(p.total_cost ?? 0),
    );
  const actOpen = new Set(
    (acts ?? [])
      .filter((a) => ACTION_OPEN.includes(a.status as ActionStatus))
      .map((a) => a.id),
  );
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="card">
      <h2>Maintenance history</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="list-table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Date</th>
              <th>Mileage</th>
              <th>Reason</th>
              <th>Mechanic</th>
              <th>Labour</th>
              <th>Parts</th>
              {rate > 0 && <th>Total</th>}
              <th>Status</th>
              <th>Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = mins.get(r.id) ?? 0;
              const pc = partsCost.get(r.id) ?? 0;
              const totalCost = rate > 0 ? pc + (m / 60) * rate : pc;
              const vs = r.vehicle_status as MrVehicleStatus | null;
              const oos = vs && MR_OUT_OF_SERVICE.includes(vs);
              const followOpen =
                r.followup_action_id && actOpen.has(r.followup_action_id);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/maintenance/${r.id}`}>
                      {r.report_number ?? "Draft"}
                    </Link>
                  </td>
                  <td className="muted">{fmtDate(r.report_date)}</td>
                  <td className="muted">
                    {r.mileage != null
                      ? `${Number(r.mileage).toLocaleString()} km`
                      : "—"}
                  </td>
                  <td className="muted">
                    {(r.reasons ?? [])
                      .map((x: string) => MR_REASON_LABELS[x as MrReason] ?? x)
                      .join(", ") || "—"}
                  </td>
                  <td className="muted">
                    {nameById.get(r.created_by ?? "") ?? "—"}
                  </td>
                  <td className="muted">{minutesToHm(m)}</td>
                  <td className="muted">{pc > 0 ? fmtMoney(pc) : "—"}</td>
                  {rate > 0 && (
                    <td>{totalCost > 0 ? fmtMoney(totalCost) : "—"}</td>
                  )}
                  <td>
                    {r.status === "draft" ? (
                      <span className="badge">Draft</span>
                    ) : (
                      <span className={oos ? "blocked" : undefined}>
                        {vs ? MR_VEHICLE_STATUS_LABELS[vs] : "Completed"}
                      </span>
                    )}
                  </td>
                  <td>
                    {followOpen ? (
                      <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                        Outstanding
                      </span>
                    ) : r.followup_required ? (
                      "Done"
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
    </div>
  );
}
