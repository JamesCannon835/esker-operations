import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TicketForm } from "../../ticket-form";
import { updateTicket } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: t }, { data: suppliers }, { data: products }] =
    await Promise.all([
      supabase
        .from("delivery_tickets")
        .select(
          "id, supplier_id, product_id, product_name, unit, quantity, unit_price, docket_number, delivered_on, vehicle_reg, notes",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase
        .from("supplier_products")
        .select("id, supplier_id, name, unit, unit_price")
        .order("name"),
    ]);

  if (!t) notFound();

  return (
    <>
      <Link className="link-back" href={`/deliveries/${id}`}>
        ← Back
      </Link>
      <div className="page-head">
        <h1>Edit ticket</h1>
      </div>
      <div className="card">
        <TicketForm
          action={updateTicket.bind(null, id)}
          suppliers={suppliers ?? []}
          products={products ?? []}
          defaults={t}
        />
      </div>
    </>
  );
}
