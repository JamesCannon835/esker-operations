import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getMechanics } from "@/lib/assets-server";
import { vehicleName } from "@/lib/asset-name";
import { fmtDate } from "@/lib/format";
import { VI_STATUS_LABELS } from "@/lib/vehicle-inspection";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  inspection_number: string | null;
  vehicle_id: string;
  inspector_id: string | null;
  odometer: number | null;
  inspection_date: string;
  status: string;
  result: string | null;
  out_of_service: boolean;
};

type SP = {
  show?: string;
  vehicle?: string;
  inspector?: string;
  from?: string;
  to?: string;
};

export default async function VehicleInspectionsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  const manager = isManager(roles);

  const sp = await searchParams;
  const filter = sp.show ?? "all";

  const supabase = await createClient();
  let query = supabase
    .from("vehicle_inspections")
    .select(
      "id, inspection_number, vehicle_id, inspector_id, odometer, inspection_date, status, result, out_of_service",
    )
    .order("inspection_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (filter === "drafts") query = query.eq("status", "draft");
  else if (filter === "oos") query = query.eq("out_of_service", true);
  else if (filter === "defects")
    query = query.in("result", ["defects", "out_of_service"]);
  else if (filter === "passed") query = query.eq("result", "passed");

  if (sp.vehicle) query = query.eq("vehicle_id", sp.vehicle);
  if (sp.inspector) query = query.eq("inspector_id", sp.inspector);
  if (sp.from) query = query.gte("inspection_date", sp.from);
  if (sp.to) query = query.lte("inspection_date", sp.to);

  const [{ data, error }, { data: vehicles }, mechanics] = await Promise.all([
    query,
    supabase
      .from("vehicles")
      .select("id, fleet_number, registration")
      .eq("voided", false)
      .order("registration"),
    getMechanics(),
  ]);
  const rows = (data ?? []) as Row[];

  // open-defect counts
  const ids = rows.map((r) => r.id);
  const openByInsp = new Map<string, number>();
  const totalByInsp = new Map<string, number>();
  if (ids.length) {
    const { data: defs } = await supabase
      .from("vehicle_inspection_results")
      .select("inspection_id, fault_id")
      .in("inspection_id", ids)
      .eq("result", "defect");
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
    for (const d of defs ?? []) {
      totalByInsp.set(
        d.inspection_id,
        (totalByInsp.get(d.inspection_id) ?? 0) + 1,
      );
      if (!d.fault_id || !closed.has(d.fault_id))
        openByInsp.set(
          d.inspection_id,
          (openByInsp.get(d.inspection_id) ?? 0) + 1,
        );
    }
  }

  const vMap = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      vehicleName(v.fleet_number, v.registration),
    ]),
  );
  const uMap = new Map(mechanics.map((m) => [m.id, m.full_name]));

  const TABS = [
    { key: "all", label: "All" },
    { key: "drafts", label: "In progress" },
    { key: "defects", label: "Defects" },
    { key: "oos", label: "Out of service" },
    { key: "passed", label: "Passed" },
  ];
  const keep = (extra: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) p.set(k, v);
    return `/vehicle-inspections?${p.toString()}`;
  };

  return (
    <>
      <div className="page-head">
        <h1>Vehicle inspections</h1>
        <Link className="btn small" href="/vehicle-inspections/new">
          + New inspection
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
              <label htmlFor="fi-veh">Vehicle</label>
              <select id="fi-veh" name="vehicle" defaultValue={sp.vehicle ?? ""}>
                <option value="">All</option>
                {(vehicles ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleName(v.fleet_number, v.registration)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fi-insp">Inspector</label>
              <select
                id="fi-insp"
                name="inspector"
                defaultValue={sp.inspector ?? ""}
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
              <label htmlFor="fi-from">From</label>
              <input id="fi-from" name="from" type="date" defaultValue={sp.from ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="fi-to">To</label>
              <input id="fi-to" name="to" type="date" defaultValue={sp.to ?? ""} />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn small" type="submit">
              Apply
            </button>
            <Link
              className="btn ghost small"
              href={`/vehicle-inspections?show=${filter}`}
            >
              Clear
            </Link>
          </div>
        </form>
      )}

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No inspections match.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Inspection</th>
                  <th>Date</th>
                  <th>Vehicle</th>
                  {manager && <th>Inspector</th>}
                  <th>Odometer</th>
                  <th>Defects</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = openByInsp.get(r.id) ?? 0;
                  const tot = totalByInsp.get(r.id) ?? 0;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/vehicle-inspections/${r.id}`}>
                          {r.inspection_number ?? "Draft"}
                        </Link>
                      </td>
                      <td className="muted">{fmtDate(r.inspection_date)}</td>
                      <td className="muted">{vMap.get(r.vehicle_id) ?? "—"}</td>
                      {manager && (
                        <td className="muted">
                          {uMap.get(r.inspector_id ?? "") ?? "—"}
                        </td>
                      )}
                      <td className="muted">
                        {r.odometer != null
                          ? `${Number(r.odometer).toLocaleString()} km`
                          : "—"}
                      </td>
                      <td className={open > 0 ? "blocked" : "muted"}>
                        {tot === 0
                          ? "—"
                          : open > 0
                            ? `${open} open / ${tot}`
                            : `${tot} rectified`}
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
        )}
      </div>
    </>
  );
}
