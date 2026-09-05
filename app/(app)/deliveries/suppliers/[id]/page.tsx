import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { SupplierForm } from "../../supplier-form";
import { ProductForm } from "../../product-form";
import {
  saveSupplier,
  deleteSupplier,
  saveProduct,
  deleteProduct,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: supplier }, { data: products }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("supplier_products")
      .select("id, name, unit, unit_price, active")
      .eq("supplier_id", id)
      .order("name"),
  ]);

  if (!supplier) notFound();

  return (
    <>
      <Link className="link-back" href="/deliveries/suppliers">
        ← Suppliers
      </Link>
      <div className="page-head">
        <h1>{supplier.name}</h1>
        <ConfirmButton
          action={deleteSupplier.bind(null, id)}
          label="Delete supplier"
          className="btn small ghost"
          confirmText="Delete this supplier? If it has deliveries it will just be marked inactive."
        />
      </div>

      <div className="card">
        <h2>Products &amp; prices</h2>
        {!products || products.length === 0 ? (
          <p className="empty">No products yet — add one below.</p>
        ) : (
          <div className="del-rows">
            {products.map((p) => (
              <details key={p.id} className="del-product">
                <summary>
                  <span>
                    <strong>{p.name}</strong>{" "}
                    <span className="muted">
                      {p.unit_price != null
                        ? `${fmtMoney(p.unit_price)}/${p.unit}`
                        : `no price · ${p.unit}`}
                      {!p.active ? " · off" : ""}
                    </span>
                  </span>
                </summary>
                <div style={{ padding: "10px 0" }}>
                  <ProductForm
                    action={saveProduct.bind(null, id, p.id)}
                    defaults={p}
                    submitLabel="Save"
                  />
                  <div style={{ marginTop: 8 }}>
                    <ConfirmButton
                      action={deleteProduct.bind(null, p.id, id)}
                      label="Delete product"
                      className="btn ghost small"
                      confirmText={`Delete "${p.name}"? If it's on past deliveries it will just be turned off.`}
                    />
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <ProductForm
            action={saveProduct.bind(null, id, null)}
            submitLabel="Add product"
          />
        </div>
      </div>

      <div className="card">
        <h2>Supplier details</h2>
        <SupplierForm
          action={saveSupplier.bind(null, id)}
          defaults={supplier}
          submitLabel="Save"
        />
      </div>
    </>
  );
}
