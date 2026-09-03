import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { resolveAssetLabels } from "@/lib/asset-labels";
import { fmtDate } from "@/lib/format";
import { INSPECTION_TYPE_LABELS } from "@/lib/inspections";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const { user, roles } = await requireUser();
  const showAll = isManager(roles);
  const canRunScheduled = showAll || hasRole(roles, "mechanic");
  const supabase = await createClient();

  let query = supabase
    .from("inspections")
    .select(
      "id, inspection_type, asset_type, asset_id, result, completed_at, completed_by, mileage_or_hours",
    )
    .eq("voided", false)
    .order("completed_at", { ascending: false })
    .limit(100);
  if (!showAll) query = query.eq("completed_by", user.id);

  const { data: inspections, error } = await query;
  const rows = inspections ?? [];

  const labels = await resolveAssetLabels(rows);

  const whoIds = [...new Set(rows.map((r) => r.completed_by).filter(Boolean))];
  const whoMap = new Map<string, string>();
  if (showAll && whoIds.length) {
    const { data: people } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", whoIds as string[]);
    for (const p of people ?? []) whoMap.set(p.id, p.full_name);
  }

  return (
    <>
      <div className="page-head">
        <h1>{showAll ? "Inspections" : "My inspections"}</h1>
        {canRunScheduled && (
          <Link className="btn small" href="/inspections/new">
            + New inspection
          </Link>
        )}
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No inspections recorded yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Asset</th>
                {showAll && <th>By</th>}
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/inspections/${r.id}`}>
                      {fmtDate(r.completed_at)}
                    </Link>
                  </td>
                  <td className="muted">
                    {INSPECTION_TYPE_LABELS[r.inspection_type] ??
                      r.inspection_type}
                  </td>
                  <td className="muted">
                    {labels.get(`${r.asset_type}:${r.asset_id}`) ?? "—"}
                  </td>
                  {showAll && (
                    <td className="muted">
                      {whoMap.get(r.completed_by ?? "") ?? "—"}
                    </td>
                  )}
                  <td>
                    <span
                      className={
                        r.result === "fail" ? "blocked" : "ok"
                      }
                    >
                      {r.result === "fail" ? "Fail" : "Pass"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
