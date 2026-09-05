import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, canProduction } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  PRECAST_STATUS_LABELS,
  feetLabel,
  fmtM,
  metres,
  lineMetres,
  type PrecastLine,
} from "@/lib/precast";
import { ConfirmButton } from "@/components/confirm-button";
import { markOrderDone, setOrderStatus, deleteOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrecastOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { roles } = await requireUser();
  if (!canProduction(roles)) redirect("/dashboard");
  const manager = isManager(roles);
  const supabase = await createClient();

  const [{ data: order }, { data: lines }] = await Promise.all([
    supabase.from("precast_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("precast_order_lines")
      .select("*")
      .eq("order_id", id)
      .order("sort_order"),
  ]);
  if (!order) notFound();

  const rows = (lines ?? []) as PrecastLine[];
  const totalM = rows.reduce((s, l) => s + (lineMetres(l) ?? 0), 0);
  const done = order.status === "done";
  const cancelled = order.status === "cancelled";

  let doneName = "";
  if (order.done_by) {
    const { data: u } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", order.done_by)
      .maybeSingle();
    doneName = u?.full_name ?? "";
  }

  return (
    <>
      <Link className="link-back" href="/precast">
        ← Precast orders
      </Link>
      <div className="page-head">
        <h1>{order.order_number ?? "Precast order"}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {manager && (
            <>
              <a className="btn small ghost" href={`/precast/${id}/docket`}>
                Docket PDF
              </a>
              <Link className="btn small ghost" href={`/precast/${id}/edit`}>
                Edit
              </Link>
              <ConfirmButton
                action={deleteOrder.bind(null, id)}
                label="Delete"
                className="btn small ghost"
                confirmText="Delete this precast order?"
              />
            </>
          )}
        </div>
      </div>

      <p className="hint">
        {[
          order.customer,
          order.phone,
          order.required_date || order.required_time
            ? `needed ${[
                order.required_date ? fmtDate(order.required_date) : null,
                order.required_time,
              ]
                .filter(Boolean)
                .join(" ")}`
            : null,
          `${PRECAST_STATUS_LABELS[order.status] ?? order.status}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        {order.notes ? ` — ${order.notes}` : ""}
      </p>

      {/* Yard view: feet. Management view: feet + metres. */}
      <div className="card">
        <h2>{manager ? "Order" : "To make"}</h2>
        <table className="list-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Length</th>
              <th>Qty</th>
              {manager && <th>Metres each</th>}
              {manager && <th>Line total</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.product_name}
                  {l.notes && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {l.notes}
                    </div>
                  )}
                </td>
                <td className="muted">
                  {l.length_text || feetLabel(l.length_ft)}
                </td>
                <td className="muted">{l.quantity}</td>
                {manager && (
                  <td className="muted">{fmtM(metres(l.length_ft))}</td>
                )}
                {manager && (
                  <td className="muted">{fmtM(lineMetres(l))}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {manager && (
          <p className="hint" style={{ marginTop: 10 }}>
            Total for the docket: <strong>{fmtM(totalM)}</strong>
          </p>
        )}
      </div>

      <div className="card">
        {done ? (
          <p className="hint" style={{ margin: 0 }}>
            Marked done {order.done_at ? fmtDateTime(order.done_at) : ""}
            {doneName ? ` by ${doneName}` : ""}.
          </p>
        ) : cancelled ? (
          <p className="hint" style={{ margin: 0 }}>
            This order is cancelled.
          </p>
        ) : (
          <ConfirmButton
            action={markOrderDone.bind(null, id)}
            label="Mark this order done"
            className="btn"
            confirmText="Mark this precast order as done?"
          />
        )}
        {(done || cancelled) && (
          <div style={{ marginTop: 10 }}>
            <ConfirmButton
              action={setOrderStatus.bind(null, id, "in_progress")}
              label="Reopen"
              className="btn ghost small"
            />
          </div>
        )}
        {!done && !cancelled && manager && (
          <div style={{ marginTop: 10 }}>
            <ConfirmButton
              action={setOrderStatus.bind(null, id, "cancelled")}
              label="Cancel order"
              className="btn ghost small"
              confirmText="Cancel this order?"
            />
          </div>
        )}
      </div>
    </>
  );
}
