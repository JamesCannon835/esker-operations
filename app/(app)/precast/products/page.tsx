import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "@/components/confirm-button";
import { ProductForm } from "../product-form";
import { deleteProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrecastProductsPage() {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/precast");
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("precast_products")
    .select("id, name, sort_order, active")
    .order("sort_order")
    .order("name");

  return (
    <>
      <Link className="link-back" href="/precast">
        ← Precast orders
      </Link>
      <div className="page-head">
        <h1>Precast products</h1>
      </div>
      <p className="hint">
        The product list the order form offers. You can also type a product that
        isn&apos;t on the list.
      </p>

      <div className="card">
        <div className="del-rows">
          {(products ?? []).map((p) => (
            <details key={p.id} className="del-product">
              <summary>
                <strong>{p.name}</strong>{" "}
                <span className="muted">
                  position {p.sort_order}
                  {p.active ? "" : " · off"}
                </span>
              </summary>
              <div style={{ padding: "10px 0" }}>
                <ProductForm id={p.id} defaults={p} submitLabel="Save" />
                <div style={{ marginTop: 8 }}>
                  <ConfirmButton
                    action={deleteProduct.bind(null, p.id)}
                    label="Delete"
                    className="btn ghost small"
                    confirmText={`Delete "${p.name}"?`}
                  />
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Add a product</h2>
        <ProductForm id={null} submitLabel="Add" />
      </div>
    </>
  );
}
