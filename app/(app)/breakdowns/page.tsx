import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { fmtDateTime } from "@/lib/format";
import {
  breakdownStage,
  BREAKDOWN_STAGE_LABELS,
  downtimeMs,
  formatDowntime,
} from "@/lib/breakdowns";

export const dynamic = "force-dynamic";

export default async function BreakdownsPage() {
  const { user, roles } = await requireUser();
  const showAll = isManager(roles) || hasRole(roles, "mechanic");
  const supabase = await createClient();

  let query = supabase
    .from("breakdowns")
    .select(
      "id, vehicle_id, problem_description, immobilised, reported_at, mechanic_notified_at, mechanic_arrived_at, repair_completed_at, returned_to_service_at",
    )
    .order("reported_at", { ascending: false })
    .limit(200);
  if (!showAll) query = query.eq("driver_id", user.id);

  const { data: breakdowns, error } = await query;
  const rows = breakdowns ?? [];

  const vids = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))];
  const vmap = new Map<string, string>();
  if (vids.length) {
    const { data } = await supabase
      .from("vehicles")
      .select("id, fleet_number, registration")
      .in("id", vids as string[]);
    for (const v of data ?? [])
      vmap.set(v.id, `${v.fleet_number} · ${v.registration}`);
  }

  return (
    <>
      <div className="page-head">
        <h1>{showAll ? "Breakdowns" : "My breakdowns"}</h1>
        <Link className="btn small danger" href="/breakdowns/new">
          Report breakdown
        </Link>
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No breakdowns recorded.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Reported</th>
                <th>Vehicle</th>
                <th>Problem</th>
                <th>Stage</th>
                <th>Downtime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const stage = breakdownStage(b);
                return (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/breakdowns/${b.id}`}>
                        {fmtDateTime(b.reported_at)}
                      </Link>
                    </td>
                    <td className="muted">{vmap.get(b.vehicle_id ?? "") ?? "—"}</td>
                    <td>
                      {b.problem_description}
                      {b.immobilised && (
                        <span className="blocked"> · immobilised</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          stage === "back_in_service" ? "ok" : ""
                        }
                        style={
                          stage !== "back_in_service"
                            ? { color: "var(--amber)", fontWeight: 600 }
                            : undefined
                        }
                      >
                        {BREAKDOWN_STAGE_LABELS[stage]}
                      </span>
                    </td>
                    <td className="muted">
                      {formatDowntime(downtimeMs(b))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
