import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { NewWeekForm } from "./new-week-form";

export const dynamic = "force-dynamic";

export default async function VertiBlockPage() {
  const { roles } = await requireUser();
  if (!hasRole(roles, "plant_operator") && !isManager(roles)) {
    redirect("/dashboard");
  }
  const manager = isManager(roles);
  const supabase = await createClient();

  const [{ data: weeks }, { data: days }] = await Promise.all([
    supabase
      .from("verti_production_weeks")
      .select("id, week_commencing, operator_name")
      .order("week_commencing", { ascending: false }),
    supabase.from("verti_production_days").select("week_id, counts"),
  ]);

  const total = new Map<string, number>();
  for (const d of days ?? []) {
    let n = 0;
    for (const v of Object.values((d.counts ?? {}) as Record<string, number>)) {
      n += Number(v) || 0;
    }
    total.set(d.week_id, (total.get(d.week_id) ?? 0) + n);
  }

  return (
    <>
      <div className="page-head">
        <h1>Verti-Block production</h1>
        {manager && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn small ghost" href="/verti-block/types">
              Block types
            </Link>
            <a className="btn small ghost" href="/verti-block/export">
              Download CSV
            </a>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Start a week</h2>
        <NewWeekForm />
      </div>

      <div className="card">
        <h2>Weekly records</h2>
        {!weeks || weeks.length === 0 ? (
          <p className="empty">No sheets yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Week commencing</th>
                <th>Operator</th>
                <th>Blocks made</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/verti-block/${w.id}`}>
                      {fmtDate(w.week_commencing)}
                    </Link>
                  </td>
                  <td className="muted">{w.operator_name ?? "—"}</td>
                  <td className="muted">{total.get(w.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
