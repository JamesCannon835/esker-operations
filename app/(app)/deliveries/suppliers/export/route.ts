import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, account_ref, contact, phone, email, active, notes")
      .order("name"),
    supabase
      .from("supplier_products")
      .select("supplier_id, name, unit, unit_price, active")
      .order("name"),
  ]);

  type Prod = {
    supplier_id: string;
    name: string;
    unit: string;
    unit_price: number | null;
    active: boolean;
  };
  const bySupplier = new Map<string, Prod[]>();
  for (const p of (products ?? []) as Prod[]) {
    const arr = bySupplier.get(p.supplier_id) ?? [];
    arr.push(p);
    bySupplier.set(p.supplier_id, arr);
  }

  const rows: (string | number | null)[][] = [];
  for (const s of suppliers ?? []) {
    const prods = bySupplier.get(s.id) ?? [];
    if (prods.length === 0) {
      rows.push([
        s.name,
        s.account_ref,
        s.contact,
        s.phone,
        s.email,
        s.active ? "active" : "inactive",
        "",
        "",
        "",
        "",
      ]);
    }
    for (const p of prods) {
      rows.push([
        s.name,
        s.account_ref,
        s.contact,
        s.phone,
        s.email,
        s.active ? "active" : "inactive",
        p.name,
        p.unit,
        p.unit_price ?? "",
        p.active ? "active" : "inactive",
      ]);
    }
  }

  const csv = toCsv(
    [
      "Supplier",
      "Account no.",
      "Contact",
      "Phone",
      "Email",
      "Supplier status",
      "Product",
      "Unit",
      "Unit price",
      "Product status",
    ],
    rows,
  );
  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(`suppliers-and-prices-${today}.csv`, csv);
}
