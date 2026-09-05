import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { fmtKg, LOAD_STATUS_LABELS } from "@/lib/verti-block";

export const dynamic = "force-dynamic";

export default async function LoadsPage() {
  const { roles } = await requireUser();
  if (!hasRole(roles, "plant_operator") && !isManager(roles)) {
    redirect("/dashboard");
  }
  const supabase = await createClient();

  const [{ data: loads }, { data: lines }, { data: types }] = await Promise.all([
    supabase
      .from("verti_loads")
      .select("id, reference, customer, load_date, truck_reg, max_payload_kg, status")
      .order("load_date", { ascending: false }),
    supabase
      .from("verti_load_lines")
      .select("load_id, quantity, weight_kg"),
    supabase.from("verti_block_types").select("id, weight_kg"),
  ]);

  const weightOf = new Map(
    (types ?? []).map((t) => [t.id, t.weight_kg as number | null]),
  );
  const agg = new Map<string, { blocks: number; kg: number }>();
  for (const l of lines ?? []) {
    const a = agg.get(l.load_id) ?? { blocks: 0, kg: 0 };
    a.blocks += Number(l.quantity) || 0;
    const w = l.weight_kg ?? null;
    if (w != null) a.kg += (Number(l.quantity) || 0) * Number(w);
    agg.set(l.load_id, a);
  }

  return (
    <>
      <Link className="link-back" href="/verti-block">
        ← Verti-Block production
      </Link>
      <div className="page-head">
        <h1>Loads</h1>
        <Link className="btn small" href="/verti-block/loads/new">
          + New load
        </Link>
      </div>

      <div className="card">
        {!loads || loads.length === 0 ? (
          <p className="empty">
            No loads yet. <Link href="/verti-block/loads/new">Start one</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Load</th>
                <th>Date</th>
                <th>Blocks</th>
                <th>Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((l) => {
                const a = agg.get(l.id) ?? { blocks: 0, kg: 0 };
                const over =
                  l.max_payload_kg != null && a.kg > l.max_payload_kg;
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/verti-block/loads/${l.id}`}>
                        {l.reference || l.customer || "Load"}
                      </Link>
                      {l.reference && l.customer && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {l.customer}
                        </div>
                      )}
                    </td>
                    <td className="muted">{fmtDate(l.load_date)}</td>
                    <td className="muted">{a.blocks}</td>
                    <td className={over ? "" : "muted"}>
                      {over ? (
                        <span className="blocked">{fmtKg(a.kg)}</span>
                      ) : (
                        fmtKg(a.kg)
                      )}
                    </td>
                    <td className="muted">
                      {LOAD_STATUS_LABELS[l.status] ?? l.status}
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
