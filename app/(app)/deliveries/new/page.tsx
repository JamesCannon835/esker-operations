import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TicketBatchForm } from "../ticket-batch-form";

export const dynamic = "force-dynamic";

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireManager();
  const supabase = await createClient();
  const { from } = await searchParams;

  const [{ data: suppliers }, { data: products }, cloneFrom] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    supabase
      .from("supplier_products")
      .select("id, supplier_id, name, unit, unit_price")
      .eq("active", true)
      .order("name"),
    from
      ? supabase
          .from("delivery_tickets")
          .select(
            "supplier_id, product_id, product_name, unit, quantity, unit_price, vehicle_reg",
          )
          .eq("id", from)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const c = cloneFrom?.data;
  const defaults = c
    ? {
        supplier_id: c.supplier_id,
        row: {
          productId: c.product_id ?? "",
          name: c.product_name,
          unit: c.unit,
          qty: String(c.quantity),
          price: c.unit_price != null ? String(c.unit_price) : "",
          reg: c.vehicle_reg ?? "",
        },
      }
    : undefined;

  return (
    <>
      <Link className="link-back" href="/deliveries">
        ← Goods in
      </Link>
      <div className="page-head">
        <h1>{c ? "New ticket (from a copy)" : "New delivery ticket(s)"}</h1>
      </div>
      <div className="card">
        <TicketBatchForm
          suppliers={suppliers ?? []}
          products={products ?? []}
          defaults={defaults}
        />
      </div>
      <p className="hint">
        Add one line per load. Use <strong>Duplicate</strong> on a line, or
        <strong> + Add line</strong>, to key in several at once — they all save
        as separate tickets.
      </p>
    </>
  );
}
