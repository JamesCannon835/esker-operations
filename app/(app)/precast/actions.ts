"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, canProduction } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { feetLabel } from "@/lib/precast";

export type FormState = { error?: string };

async function requirePrecast() {
  const s = await requireUser();
  if (!canProduction(s.roles)) redirect("/dashboard");
  return s;
}

async function requirePrecastManager() {
  const s = await requireUser();
  if (!isManager(s.roles)) redirect("/precast");
  return s;
}

function refresh(id?: string) {
  revalidatePath("/precast");
  if (id) revalidatePath(`/precast/${id}`);
  revalidatePath("/dashboard");
}

async function nextOrderNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("precast_orders")
    .select("*", { count: "exact", head: true })
    .gte("order_date", `${year}-01-01`)
    .lte("order_date", `${year}-12-31`);
  return `PCO-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

type LineInput = {
  product_id: string | null;
  product_name: string;
  length_ft: number | null;
  length_text: string | null;
  quantity: number;
  notes: string | null;
};

function readLines(formData: FormData): LineInput[] {
  const pids = formData.getAll("product_id").map(String);
  const names = formData.getAll("product_name").map(String);
  const feets = formData.getAll("length_ft_whole").map(String);
  const inchs = formData.getAll("length_in").map(String);
  const qtys = formData.getAll("quantity").map(String);
  const notes = formData.getAll("line_notes").map(String);

  const out: LineInput[] = [];
  for (let i = 0; i < qtys.length; i++) {
    const name = names[i]?.trim() || "";
    const pid = pids[i]?.trim() || null;
    const q = Math.max(0, Math.round(Number(qtys[i]) || 0));
    if (!name && !pid) continue;
    if (q <= 0) continue;

    const feet = Number(feets[i]);
    const inch = Number(inchs[i]) || 0;
    const length_ft =
      Number.isFinite(feet) && feet > 0 ? feet + inch / 12 : null;

    out.push({
      product_id: pid,
      product_name: name,
      length_ft,
      length_text: length_ft != null ? feetLabel(length_ft) : null,
      quantity: q,
      notes: notes[i]?.trim() || null,
    });
  }
  return out;
}

async function saveLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  lines: LineInput[],
) {
  await supabase.from("precast_order_lines").delete().eq("order_id", orderId);
  if (lines.length === 0) return;
  const { data: prods } = await supabase
    .from("precast_products")
    .select("id, name");
  const nameOf = new Map((prods ?? []).map((p) => [p.id, p.name as string]));
  await supabase.from("precast_order_lines").insert(
    lines.map((l, i) => ({
      order_id: orderId,
      product_id: l.product_id,
      product_name:
        l.product_name || (l.product_id ? nameOf.get(l.product_id) ?? "" : "") ||
        "Precast item",
      length_ft: l.length_ft,
      length_text: l.length_text,
      quantity: l.quantity,
      notes: l.notes,
      sort_order: i,
    })),
  );
}

export async function createOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requirePrecastManager();
  const supabase = await createClient();

  const lines = readLines(formData);
  if (lines.length === 0)
    return { error: "Add at least one line with a product, length and quantity." };

  const { data: order, error } = await supabase
    .from("precast_orders")
    .insert({
      order_number: await nextOrderNumber(supabase),
      customer: orNull(formData.get("customer")),
      phone: orNull(formData.get("phone")),
      required_date: orNull(formData.get("required_date")),
      required_time: orNull(formData.get("required_time")),
      assigned_to: orNull(formData.get("assigned_to")),
      notes: orNull(formData.get("notes")),
      taken_by: user.id,
      status: "new",
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };

  await saveLines(supabase, order.id, lines);
  refresh(order.id);
  redirect(`/precast/${order.id}`);
}

export async function updateOrder(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePrecastManager();
  const supabase = await createClient();

  const lines = readLines(formData);
  if (lines.length === 0)
    return { error: "Add at least one line." };

  const { error } = await supabase
    .from("precast_orders")
    .update({
      customer: orNull(formData.get("customer")),
      phone: orNull(formData.get("phone")),
      required_date: orNull(formData.get("required_date")),
      required_time: orNull(formData.get("required_time")),
      assigned_to: orNull(formData.get("assigned_to")),
      notes: orNull(formData.get("notes")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  await saveLines(supabase, id, lines);
  refresh(id);
  redirect(`/precast/${id}`);
}

export async function markOrderDone(id: string) {
  const { user } = await requirePrecast();
  const supabase = await createClient();
  await supabase
    .from("precast_orders")
    .update({
      status: "done",
      done_by: user.id,
      done_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  refresh(id);
}

export async function setOrderStatus(id: string, status: string) {
  await requirePrecast();
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status !== "done") {
    patch.done_by = null;
    patch.done_at = null;
  }
  await supabase.from("precast_orders").update(patch).eq("id", id);
  refresh(id);
}

export async function deleteOrder(id: string) {
  await requirePrecastManager();
  const supabase = await createClient();
  await supabase.from("precast_orders").delete().eq("id", id);
  refresh();
  redirect("/precast");
}

// ---- products (management) --------------------------------------
export async function saveProduct(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePrecastManager();
  const supabase = await createClient();
  const name = orNull(formData.get("name"));
  if (!name) return { error: "Enter a name." };
  const row = {
    name,
    sort_order: numOrNull(formData.get("sort_order")) ?? 100,
    active: formData.get("active") !== null,
  };
  const { error } = id
    ? await supabase.from("precast_products").update(row).eq("id", id)
    : await supabase.from("precast_products").insert(row);
  if (error) return { error: friendlyDbError(error.message) };
  refresh();
  redirect("/precast/products");
}

export async function deleteProduct(id: string) {
  await requirePrecastManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("precast_products")
    .delete()
    .eq("id", id);
  if (error) {
    await supabase
      .from("precast_products")
      .update({ active: false })
      .eq("id", id);
  }
  refresh();
  redirect("/precast/products");
}
