import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { lineTotal } from "@/lib/deliveries";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireManager();
  const supabase = await createClient();
  const url = new URL(request.url);
  const supplier = url.searchParams.get("supplier");
  const from = url.searchParams.get("from") || "2000-01-01";
  const to = url.searchParams.get("to") || "2999-12-31";

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name");
  const nameOf = new Map((suppliers ?? []).map((s) => [s.id, s.name as string]));

  let q = supabase
    .from("delivery_tickets")
    .select(
      "supplier_id, product_name, unit, quantity, unit_price, docket_number, delivered_on, vehicle_reg, notes",
    )
    .gte("delivered_on", from)
    .lte("delivered_on", to)
    .order("delivered_on", { ascending: true });
  if (supplier) q = q.eq("supplier_id", supplier);
  const { data: tickets } = await q;

  const rows = (tickets ?? []).map((t) => [
    t.delivered_on,
    nameOf.get(t.supplier_id) ?? "",
    t.product_name,
    t.quantity,
    t.unit,
    t.unit_price ?? "",
    lineTotal(t.quantity, t.unit_price) ?? "",
    t.docket_number ?? "",
    t.vehicle_reg ?? "",
    t.notes ?? "",
  ]);

  const csv = toCsv(
    [
      "Date",
      "Supplier",
      "Product",
      "Quantity",
      "Unit",
      "Unit price",
      "Line total",
      "Docket no.",
      "Truck reg",
      "Notes",
    ],
    rows,
  );

  const tag = supplier ? (nameOf.get(supplier) ?? "supplier") : "all";
  const safe = tag.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  return csvResponse(`goods-in-${safe}-${from}-to-${to}.csv`, csv);
}
