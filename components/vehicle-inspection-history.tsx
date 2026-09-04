import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { VI_STATUS_LABELS } from "@/lib/vehicle-inspection";

/** Vehicle Inspection & Rectification Reports for one vehicle. */
export async function VehicleInspectionHistory({
  vehicleId,
}: {
  vehicleId: string;
}) {
  const supabase = await createClient();

  const { data: inspections } = await supabase
    .from("vehicle_inspections")
    .select(
      "id, inspection_number, inspection_date, odometer, status, result, out_of_service, inspector_id",
    )
    .eq("vehicle_id", vehicleId)
    .order("inspection_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = inspections ?? [];
  if (rows.length === 0) {
    return (
      <div className="card">
        <h2>Vehicle inspections</h2>
        <p className="hint" style={{ margin: 0 }}>
          No inspections for this vehicle yet.
        </p>
      </div>
    );
  }

  const ids = rows.map((r) => r.id);
  const [{ data: defs }, { data: people }] = await Promise.all([
    supabase
      .from("vehicle_inspection_results")
      .select("inspection_id, fault_id")
      .in("inspection_id", ids)
      .eq("result", "defect"),
    supabase
      .from("users")
      .select("id, full_name")
      .in(
        "id",
        [...new Set(rows.map((r) => r.inspector_id).filter(Boolean))] as string[],
      ),
  ]);

  const faultIds = [
    ...new Set((defs ?? []).map((d) => d.fault_id).filter(Boolean)),
  ] as string[];
  const closed = new Set<string>();
  if (faultIds.length) {
    const { data: fs } = await supabase
      .from("faults")
      .select("id, status")
      .in("id", faultIds);
    for (const f of fs ?? []) if (f.status === "closed") closed.add(f.id);
  }
  const total = new Map<string, number>();
  const open = new Map<string, number>();
  for (const d of defs ?? []) {
    total.set(d.inspection_id, (total.get(d.inspection_id) ?? 0) + 1);
    if (!d.fault_id || !closed.has(d.fault_id))
      open.set(d.inspection_id, (open.get(d.inspection_id) ?? 0) + 1);
  }
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="card">
      <h2>Vehicle inspections</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="list-table">
          <thead>
            <tr>
              <th>Inspection</th>
              <th>Date</th>
              <th>Odometer</th>
              <th>Inspector</th>
              <th>Defects</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const o = open.get(r.id) ?? 0;
              const t = total.get(r.id) ?? 0;
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/vehicle-inspections/${r.id}`}>
                      {r.inspection_number ?? "Draft"}
                    </Link>
                  </td>
                  <td className="muted">{fmtDate(r.inspection_date)}</td>
                  <td className="muted">
                    {r.odometer != null
                      ? `${Number(r.odometer).toLocaleString()} km`
                      : "—"}
                  </td>
                  <td className="muted">
                    {nameById.get(r.inspector_id ?? "") ?? "—"}
                  </td>
                  <td className={o > 0 ? "blocked" : "muted"}>
                    {t === 0 ? "—" : o > 0 ? `${o} open / ${t}` : `${t} rectified`}
                  </td>
                  <td>
                    <span
                      className={
                        r.out_of_service
                          ? "blocked"
                          : r.result === "passed"
                            ? "ok"
                            : undefined
                      }
                    >
                      {r.status === "draft"
                        ? "In progress"
                        : VI_STATUS_LABELS[r.result ?? ""] ?? "—"}
                    </span>
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
