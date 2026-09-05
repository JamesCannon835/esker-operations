import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "../order-form";
import { createOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPrecastOrderPage() {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/precast");
  const supabase = await createClient();

  const [{ data: products }, { data: people }] = await Promise.all([
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

  return (
    <>
      <Link className="link-back" href="/precast">
        ← Precast orders
      </Link>
      <div className="page-head">
        <h1>New precast order</h1>
      </div>
      <div className="card">
        <OrderForm
          action={createOrder}
          products={products ?? []}
          people={(people ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
          }))}
          submitLabel="Raise order"
        />
      </div>
      <p className="hint">
        The yard gets it in feet; the customer docket comes out in metres.
      </p>
    </>
  );
}
