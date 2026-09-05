import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import { lineTotal } from "@/lib/deliveries";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteTicket } from "./actions";

export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; from?: string; to?: string }>;
}) {
  await requireManager();
  const supabase = await createClient();
  const sp = await searchParams;

  const from = sp.from || monthStart();
  const to = sp.to || new Date().toISOString().slice(0, 10);

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name")
    .order("name");

  let q = supabase
    .from("delivery_tickets")
    .select(
      "id, supplier_id, product_name, unit, quantity, unit_price, docket_number, delivered_on, vehicle_reg",
    )
    .gte("delivered_on", from)
    .lte("delivered_on", to)
    .order("delivered_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (sp.supplier) q = q.eq("supplier_id", sp.supplier);
  const { data: tickets } = await q;

  const nameOf = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  const rows = tickets ?? [];
  const total = rows.reduce(
    (s, r) => s + (lineTotal(r.quantity, r.unit_price) ?? 0),
    0,
  );
  const tonnage = rows
    .filter((r) => r.unit === "tonne")
    .reduce((s, r) => s + Number(r.quantity), 0);

  return (
    <>
      <div className="page-head">
        <h1>Goods in</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn small" href="/deliveries/new">
            + New ticket(s)
          </Link>
          <Link className="btn small ghost" href="/deliveries/suppliers">
            Suppliers
          </Link>
          <a
            className="btn small ghost"
            href={`/deliveries/export?${new URLSearchParams({
              ...(sp.supplier ? { supplier: sp.supplier } : {}),
              from,
              to,
            }).toString()}`}
          >
            Download CSV
          </a>
        </div>
      </div>

      <form className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label>
          <div className="field-hint">Supplier</div>
          <select name="supplier" defaultValue={sp.supplier ?? ""}>
            <option value="">All</option>
            {(suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="field-hint">From</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="field-hint">To</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button className="btn small" type="submit">
          Show
        </button>
      </form>

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="tile">
          <div className="label">Tickets</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="tile">
          <div className="label">Tonnage</div>
          <div className="value">{fmtNumber(tonnage, " t")}</div>
        </div>
        <div className="tile">
          <div className="label">Value</div>
          <div className="value">{fmtMoney(total)}</div>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">
            No deliveries in this range.{" "}
            <Link href="/deliveries/new">Add a ticket</Link>.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Docket</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{fmtDate(r.delivered_on)}</td>
                    <td>{nameOf.get(r.supplier_id) ?? "—"}</td>
                    <td>
                      <Link href={`/deliveries/${r.id}`}>{r.product_name}</Link>
                    </td>
                    <td className="muted">
                      {fmtNumber(r.quantity)} {r.unit}
                    </td>
                    <td className="muted">
                      {r.unit_price != null ? fmtMoney(r.unit_price) : "—"}
                    </td>
                    <td className="muted">
                      {fmtMoney(lineTotal(r.quantity, r.unit_price))}
                    </td>
                    <td className="muted">{r.docket_number ?? "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        className="btn ghost small"
                        href={`/deliveries/${r.id}/edit`}
                      >
                        Edit
                      </Link>{" "}
                      <ConfirmButton
                        action={deleteTicket.bind(null, r.id)}
                        label="Delete"
                        className="btn ghost small"
                        confirmText={`Delete this ${r.product_name} ticket (${fmtDate(
                          r.delivered_on,
                        )})?`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
