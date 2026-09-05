import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm } from "../supplier-form";
import { saveSupplier } from "../actions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase.from("suppliers").select("id, name, account_ref, active").order("name"),
    supabase.from("supplier_products").select("supplier_id, active"),
  ]);

  const count = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.active) count.set(p.supplier_id, (count.get(p.supplier_id) ?? 0) + 1);
  }

  return (
    <>
      <Link className="link-back" href="/deliveries">
        ← Goods in
      </Link>
      <div className="page-head">
        <h1>Suppliers</h1>
      </div>

      <div className="card">
        {!suppliers || suppliers.length === 0 ? (
          <p className="empty">No suppliers yet — add one below.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Account no.</th>
                <th>Products</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/deliveries/suppliers/${s.id}`}>{s.name}</Link>
                  </td>
                  <td className="muted">{s.account_ref ?? "—"}</td>
                  <td className="muted">{count.get(s.id) ?? 0}</td>
                  <td className="muted">
                    {s.active ? "Active" : <span className="blocked">Inactive</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Add a supplier</h2>
        <SupplierForm action={saveSupplier.bind(null, null)} submitLabel="Add" />
      </div>
    </>
  );
}
