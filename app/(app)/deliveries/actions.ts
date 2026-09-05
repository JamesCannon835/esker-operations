"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string };

function refresh(id?: string) {
  revalidatePath("/deliveries");
  revalidatePath("/deliveries/suppliers");
  if (id) revalidatePath(`/deliveries/${id}`);
}

// ---- suppliers ----------------------------------------------------
export async function saveSupplier(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireManager();
  const supabase = await createClient();

  const name = orNull(formData.get("name"));
  if (!name) return { error: "Enter the supplier name." };

  const row = {
    name,
    account_ref: orNull(formData.get("account_ref")),
    contact: orNull(formData.get("contact")),
    phone: orNull(formData.get("phone")),
    email: orNull(formData.get("email")),
    notes: orNull(formData.get("notes")),
    active: formData.get("active") !== null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = id
    ? await supabase
        .from("suppliers")
        .update(row)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("suppliers")
        .insert({ ...row, created_by: user.id })
        .select("id")
        .single();
  if (error) return { error: friendlyDbError(error.message) };

  refresh();
  redirect(`/deliveries/suppliers/${data.id}`);
}

export async function deleteSupplier(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) {
    // Has deliveries against it — deactivate instead of hard delete.
    await supabase.from("suppliers").update({ active: false }).eq("id", id);
  }
  refresh();
  redirect("/deliveries/suppliers");
}

// ---- products ---------------------------------------------------
export async function saveProduct(
  supplierId: string,
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const supabase = await createClient();

  const name = orNull(formData.get("name"));
  if (!name) return { error: "Enter the product name." };

  const row = {
    supplier_id: supplierId,
    name,
    unit: orNull(formData.get("unit")) ?? "tonne",
    unit_price: numOrNull(formData.get("unit_price")),
    active: formData.get("active") !== null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("supplier_products").update(row).eq("id", id)
    : await supabase.from("supplier_products").insert(row);
  if (error) return { error: friendlyDbError(error.message) };

  refresh();
  redirect(`/deliveries/suppliers/${supplierId}`);
}

export async function deleteProduct(id: string, supplierId: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_products")
    .delete()
    .eq("id", id);
  if (error) {
    await supabase
      .from("supplier_products")
      .update({ active: false })
      .eq("id", id);
  }
  refresh();
  redirect(`/deliveries/suppliers/${supplierId}`);
}

// ---- delivery tickets ------------------------------------------
type TicketInput = {
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number | null;
  docket_number: string | null;
  vehicle_reg: string | null;
};

function readRows(formData: FormData): TicketInput[] {
  const productIds = formData.getAll("product_id").map(String);
  const names = formData.getAll("product_name").map(String);
  const units = formData.getAll("unit").map(String);
  const qtys = formData.getAll("quantity").map(String);
  const prices = formData.getAll("unit_price").map(String);
  const dockets = formData.getAll("docket_number").map(String);
  const regs = formData.getAll("vehicle_reg").map(String);

  const rows: TicketInput[] = [];
  for (let i = 0; i < qtys.length; i++) {
    const q = Number(qtys[i]);
    const pid = productIds[i]?.trim() || null;
    const name = names[i]?.trim() || "";
    if (!pid && !name) continue;
    if (!Number.isFinite(q) || q <= 0) continue;
    const priceRaw = prices[i]?.trim();
    rows.push({
      product_id: pid,
      product_name: name,
      unit: units[i]?.trim() || "tonne",
      quantity: q,
      unit_price:
        priceRaw && Number.isFinite(Number(priceRaw)) ? Number(priceRaw) : null,
      docket_number: dockets[i]?.trim() || null,
      vehicle_reg: regs[i]?.trim() || null,
    });
  }
  return rows;
}

export async function createTickets(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireManager();
  const supabase = await createClient();

  const supplier_id = orNull(formData.get("supplier_id"));
  const delivered_on = orNull(formData.get("delivered_on"));
  if (!supplier_id) return { error: "Choose the supplier." };
  if (!delivered_on) return { error: "Enter the delivery date." };

  const rows = readRows(formData);
  if (rows.length === 0)
    return { error: "Add at least one line with a product and a tonnage." };

  // Resolve product names for rows that picked a product.
  const pickedIds = rows
    .map((r) => r.product_id)
    .filter((x): x is string => !!x);
  const { data: prods } = pickedIds.length
    ? await supabase
        .from("supplier_products")
        .select("id, name, unit, unit_price")
        .in("id", pickedIds)
    : { data: [] as { id: string; name: string; unit: string; unit_price: number | null }[] };
  const byId = new Map((prods ?? []).map((p) => [p.id, p]));

  const insert = rows.map((r) => {
    const p = r.product_id ? byId.get(r.product_id) : undefined;
    return {
      supplier_id,
      product_id: r.product_id,
      product_name: r.product_name || p?.name || "Material",
      unit: r.unit || p?.unit || "tonne",
      quantity: r.quantity,
      unit_price: r.unit_price ?? p?.unit_price ?? null,
      docket_number: r.docket_number,
      vehicle_reg: r.vehicle_reg,
      delivered_on,
      created_by: user.id,
    };
  });

  const { error } = await supabase.from("delivery_tickets").insert(insert);
  if (error) return { error: friendlyDbError(error.message) };

  refresh();
  redirect("/deliveries");
}

export async function updateTicket(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const supabase = await createClient();

  const supplier_id = orNull(formData.get("supplier_id"));
  const delivered_on = orNull(formData.get("delivered_on"));
  const quantity = numOrNull(formData.get("quantity"));
  const product_id = orNull(formData.get("product_id"));
  let product_name = orNull(formData.get("product_name"));

  if (!supplier_id) return { error: "Choose the supplier." };
  if (!delivered_on) return { error: "Enter the delivery date." };
  if (quantity == null || quantity <= 0)
    return { error: "Enter the tonnage." };

  if (product_id && !product_name) {
    const { data: p } = await supabase
      .from("supplier_products")
      .select("name")
      .eq("id", product_id)
      .maybeSingle();
    product_name = p?.name ?? null;
  }
  if (!product_name) return { error: "Choose or name the product." };

  const { error } = await supabase
    .from("delivery_tickets")
    .update({
      supplier_id,
      product_id,
      product_name,
      unit: orNull(formData.get("unit")) ?? "tonne",
      quantity,
      unit_price: numOrNull(formData.get("unit_price")),
      docket_number: orNull(formData.get("docket_number")),
      vehicle_reg: orNull(formData.get("vehicle_reg")),
      delivered_on,
      notes: orNull(formData.get("notes")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  refresh(id);
  redirect("/deliveries");
}

export async function deleteTicket(id: string) {
  await requireManager();
  const supabase = await createClient();
  await supabase.from("delivery_tickets").delete().eq("id", id);
  refresh();
  redirect("/deliveries");
}

export async function cloneTicket(id: string) {
  const { user } = await requireManager();
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("delivery_tickets")
    .select(
      "supplier_id, product_id, product_name, unit, quantity, unit_price, vehicle_reg",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) redirect("/deliveries");

  const { data: copy, error } = await supabase
    .from("delivery_tickets")
    .insert({
      ...t,
      delivered_on: new Date().toISOString().slice(0, 10),
      docket_number: null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));

  refresh();
  redirect(`/deliveries/${copy.id}/edit`);
}
