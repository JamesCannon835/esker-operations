import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { PrecastLine } from "@/lib/precast";
import { OrderForm } from "../../order-form";
import { updateOrder } from "../../actions";

export const dynamic = "force-dynamic";

let k = 1;

export default async function EditPrecastOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/precast");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: lines }, { data: products }, { data: people }] =
    await Promise.all([
      supabase.from("precast_orders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("precast_order_lines")
        .select("*")
        .eq("order_id", id)
        .order("sort_order"),
      supabase
        .from("precast_products")
        .select("id, name")
        .eq("active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("users")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name"),
    ]);

  if (!order) notFound();

  const rows = ((lines ?? []) as PrecastLine[]).map((l) => ({
    key: k++,
    productId: l.product_id ?? "",
    name: l.product_name,
    length: l.length_text ?? (l.length_ft != null ? String(l.length_ft) : ""),
    qty: String(l.quantity),
    notes: l.notes ?? "",
  }));

  return (
    <>
      <Link className="link-back" href={`/precast/${id}`}>
        ← Back
      </Link>
      <div className="page-head">
        <h1>Edit {order.order_number ?? "order"}</h1>
      </div>
      <div className="card">
        <OrderForm
          action={updateOrder.bind(null, id)}
          products={products ?? []}
          people={(people ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
          }))}
          defaults={{
            customer: order.customer,
            phone: order.phone,
            required_date: order.required_date,
            assigned_to: order.assigned_to,
            notes: order.notes,
            lines: rows,
          }}
          submitLabel="Save order"
        />
      </div>
    </>
  );
}
