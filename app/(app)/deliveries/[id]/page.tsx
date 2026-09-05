import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import { lineTotal } from "@/lib/deliveries";
import { ConfirmButton } from "@/components/confirm-button";
import { cloneTicket, deleteTicket } from "../actions";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("delivery_tickets")
    .select(
      "id, supplier_id, product_name, unit, quantity, unit_price, docket_number, delivered_on, vehicle_reg, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("name")
    .eq("id", t.supplier_id)
    .maybeSingle();

  const rows: [string, string][] = [
    ["Supplier", supplier?.name ?? "—"],
    ["Product", t.product_name],
    ["Quantity", `${fmtNumber(t.quantity)} ${t.unit}`],
    ["Price / unit", t.unit_price != null ? fmtMoney(t.unit_price) : "—"],
    ["Total", fmtMoney(lineTotal(t.quantity, t.unit_price))],
    ["Docket no.", t.docket_number ?? "—"],
    ["Delivered", fmtDate(t.delivered_on)],
    ["Truck reg", t.vehicle_reg ?? "—"],
    ["Notes", t.notes ?? "—"],
  ];

  return (
    <>
      <Link className="link-back" href="/deliveries">
        ← Deliveries in
      </Link>
      <div className="page-head">
        <h1>{t.product_name}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn small ghost" href={`/deliveries/${id}/edit`}>
            Edit
          </Link>
          <ConfirmButton
            action={cloneTicket.bind(null, id)}
            label="Clone"
            className="btn small ghost"
            confirmText="Make a copy of this ticket to edit?"
          />
          <ConfirmButton
            action={deleteTicket.bind(null, id)}
            label="Delete"
            className="btn small ghost"
            confirmText="Delete this delivery ticket?"
          />
        </div>
      </div>

      <div className="card">
        <table className="list-table">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th style={{ width: 140 }}>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
