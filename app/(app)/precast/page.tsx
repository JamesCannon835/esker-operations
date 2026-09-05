import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, canProduction } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { PRECAST_STATUS_LABELS, fmtM, FT_TO_M } from "@/lib/precast";

export const dynamic = "force-dynamic";

export default async function PrecastPage() {
  const { roles } = await requireUser();
  if (!canProduction(roles)) redirect("/dashboard");
  const manager = isManager(roles);
  const supabase = await createClient();

  const [{ data: orders }, { data: lines }] = await Promise.all([
    supabase
      .from("precast_orders")
      .select(
        "id, order_number, customer, required_date, status, order_date",
      )
      .order("order_date", { ascending: false }),
    supabase
      .from("precast_order_lines")
      .select("order_id, length_ft, quantity"),
  ]);

  const metresByOrder = new Map<string, number>();
  for (const l of lines ?? []) {
    if (l.length_ft == null) continue;
    metresByOrder.set(
      l.order_id,
      (metresByOrder.get(l.order_id) ?? 0) +
        Number(l.length_ft) * FT_TO_M * (Number(l.quantity) || 0),
    );
  }

  const rows = (orders ?? []).filter((o) =>
    manager ? true : o.status === "new" || o.status === "in_progress",
  );

  return (
    <>
      <div className="page-head">
        <h1>Precast orders</h1>
        {manager && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn small" href="/precast/new">
              + New order
            </Link>
            <Link className="btn small ghost" href="/precast/products">
              Products
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">
            {manager ? (
              <>
                No orders. <Link href="/precast/new">Raise one</Link>.
              </>
            ) : (
              "Nothing to make right now."
            )}
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Needed</th>
                {manager && <th>Metres</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/precast/${o.id}`}>
                      {o.order_number ?? "Order"}
                    </Link>
                  </td>
                  <td className="muted">{o.customer ?? "—"}</td>
                  <td className="muted">
                    {o.required_date ? fmtDate(o.required_date) : "—"}
                  </td>
                  {manager && (
                    <td className="muted">
                      {fmtM(metresByOrder.get(o.id) ?? 0)}
                    </td>
                  )}
                  <td>
                    {o.status === "done" ? (
                      <span className="ok">Done</span>
                    ) : o.status === "cancelled" ? (
                      <span className="blocked">Cancelled</span>
                    ) : (
                      <span className="muted">
                        {PRECAST_STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    )}
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
