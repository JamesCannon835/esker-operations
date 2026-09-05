import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, canProduction } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtMoney } from "@/lib/format";
import { fmtKg, LOAD_STATUS_LABELS } from "@/lib/verti-block";

export const dynamic = "force-dynamic";

export default async function LoadsPage() {
  const { roles } = await requireUser();
  if (!canProduction(roles)) {
    redirect("/dashboard");
  }
  const supabase = await createClient();

  const [{ data: loads }, { data: lines }] = await Promise.all([
    supabase
      .from("verti_loads")
      .select("id, reference, customer, load_date, truck_reg, max_payload_kg, status")
      .order("load_date", { ascending: false }),
    supabase
      .from("verti_load_lines")
      .select("load_id, quantity, weight_kg, unit_price"),
  ]);

  const agg = new Map<string, { blocks: number; kg: number; value: number }>();
  for (const l of lines ?? []) {
    const a = agg.get(l.load_id) ?? { blocks: 0, kg: 0, value: 0 };
    const q = Number(l.quantity) || 0;
    a.blocks += q;
    if (l.weight_kg != null) a.kg += q * Number(l.weight_kg);
    if (l.unit_price != null) a.value += q * Number(l.unit_price);
    agg.set(l.load_id, a);
  }

  return (
    <>
      <Link className="link-back" href="/verti-block">
        ← Verti-Block
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
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((l) => {
                const a = agg.get(l.id) ?? { blocks: 0, kg: 0, value: 0 };
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
                      {a.value > 0 ? fmtMoney(a.value) : "—"}
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
