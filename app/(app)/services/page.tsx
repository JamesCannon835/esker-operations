import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { resolveAssetLabels } from "@/lib/asset-labels";
import { fmtDate, fmtNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { roles } = await requireUser();
  const canLog = isManager(roles) || hasRole(roles, "mechanic");
  const showCost = isManager(roles);

  const supabase = await createClient();
  const { data: services, error } = await supabase
    .from("services")
    .select("id, asset_type, asset_id, service_date, mileage_or_hours, cost, notes")
    .order("service_date", { ascending: false })
    .limit(200);

  const rows = services ?? [];
  const labels = await resolveAssetLabels(rows);

  return (
    <>
      <div className="page-head">
        <h1>Services</h1>
        {canLog && (
          <Link className="btn small" href="/services/new">
            + Log service
          </Link>
        )}
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No services logged yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Asset</th>
                <th>Mileage / hours</th>
                {showCost && <th>Cost</th>}
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/services/${s.id}`}>
                      {fmtDate(s.service_date)}
                    </Link>
                  </td>
                  <td className="muted">
                    {labels.get(`${s.asset_type}:${s.asset_id}`) ?? "—"}
                  </td>
                  <td className="muted">{fmtNumber(s.mileage_or_hours)}</td>
                  {showCost && (
                    <td className="muted">
                      {s.cost != null ? `€${Number(s.cost).toFixed(2)}` : "—"}
                    </td>
                  )}
                  <td className="muted">
                    {s.notes
                      ? s.notes.length > 60
                        ? `${s.notes.slice(0, 60)}…`
                        : s.notes
                      : "—"}
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
