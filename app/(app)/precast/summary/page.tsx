import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtM, lineMetres } from "@/lib/precast";

export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function PrecastSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/precast");
  const supabase = await createClient();
  const sp = await searchParams;

  const from = sp.from || monthStart();
  const to = sp.to || new Date().toISOString().slice(0, 10);
  const status = sp.status || "all";

  let oq = supabase
    .from("precast_orders")
    .select("id, status")
    .gte("order_date", from)
    .lte("order_date", to);
  if (status === "outstanding") oq = oq.in("status", ["new", "in_progress"]);
  else if (status === "done") oq = oq.eq("status", "done");
  const { data: orders } = await oq;

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: lines } = orderIds.length
    ? await supabase
        .from("precast_order_lines")
        .select("order_id, product_name, length_ft, quantity")
        .in("order_id", orderIds)
    : { data: [] as { product_name: string; length_ft: number | null; quantity: number }[] };

  const agg = new Map<string, { qty: number; metres: number }>();
  let grand = 0;
  for (const l of lines ?? []) {
    const m = lineMetres(l) ?? 0;
    grand += m;
    const a = agg.get(l.product_name) ?? { qty: 0, metres: 0 };
    a.qty += l.quantity || 0;
    a.metres += m;
    agg.set(l.product_name, a);
  }
  const rows = [...agg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.metres - a.metres);

  const link = (s: string) =>
    `/precast/summary?${new URLSearchParams({ from, to, status: s })}`;

  return (
    <>
      <Link className="link-back" href="/precast">
        ← Precast orders
      </Link>
      <div className="page-head">
        <h1>Metres by product</h1>
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}
      >
        <label>
          <div className="field-hint">From</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="field-hint">To</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <input type="hidden" name="status" value={status} />
        <button className="btn small" type="submit">
          Show
        </button>
      </form>

      <div className="nav-inner" style={{ padding: 0, marginBottom: 14 }}>
        {[
          { k: "all", l: "All orders" },
          { k: "outstanding", l: "Outstanding" },
          { k: "done", l: "Done" },
        ].map((t) => (
          <Link
            key={t.k}
            href={link(t.k)}
            className="btn ghost small"
            style={
              status === t.k
                ? { background: "var(--brand)", color: "#fff" }
                : undefined
            }
          >
            {t.l}
          </Link>
        ))}
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No order lines in this range.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Pieces</th>
                <th style={{ textAlign: "right" }}>Metres</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="muted">{r.qty}</td>
                  <td style={{ textAlign: "right" }}>
                    <strong>{fmtM(r.metres)}</strong>
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td />
                <td style={{ textAlign: "right" }}>
                  <strong>{fmtM(grand)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
