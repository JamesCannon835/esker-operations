"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, canProduction } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string };

async function requireYard() {
  const s = await requireUser();
  if (!canProduction(s.roles)) {
    redirect("/dashboard");
  }
  return s;
}

function refresh(id?: string) {
  revalidatePath("/verti-block");
  revalidatePath("/verti-block/loads");
  if (id) revalidatePath(`/verti-block/loads/${id}`);
}

export async function createLoad(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireYard();
  const supabase = await createClient();

  const { data: load, error } = await supabase
    .from("verti_loads")
    .insert({
      reference: orNull(formData.get("reference")),
      customer: orNull(formData.get("customer")),
      load_date: orNull(formData.get("load_date")),
      truck_reg: orNull(formData.get("truck_reg")),
      max_payload_kg: numOrNull(formData.get("max_payload_kg")),
      notes: orNull(formData.get("notes")),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };

  refresh(load.id);
  redirect(`/verti-block/loads/${load.id}`);
}

export async function updateLoad(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireYard();
  const supabase = await createClient();
  const { error } = await supabase
    .from("verti_loads")
    .update({
      reference: orNull(formData.get("reference")),
      customer: orNull(formData.get("customer")),
      load_date: orNull(formData.get("load_date")),
      truck_reg: orNull(formData.get("truck_reg")),
      max_payload_kg: numOrNull(formData.get("max_payload_kg")),
      notes: orNull(formData.get("notes")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  refresh(id);
  redirect(`/verti-block/loads/${id}`);
}

/** Save the quantities. Field names: qty_<blockTypeId>. */
export async function saveLoadLines(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireYard();
  const supabase = await createClient();

  const { data: types } = await supabase
    .from("verti_block_types")
    .select("id, weight_kg, unit_price");

  await supabase.from("verti_load_lines").delete().eq("load_id", id);

  const rows = (types ?? [])
    .map((t) => ({
      load_id: id,
      block_type_id: t.id,
      quantity: numOrNull(formData.get(`qty_${t.id}`)) ?? 0,
      weight_kg: t.weight_kg,
      unit_price: t.unit_price,
    }))
    .filter((r) => r.quantity > 0);

  if (rows.length > 0) {
    const { error } = await supabase.from("verti_load_lines").insert(rows);
    if (error) return { error: friendlyDbError(error.message) };
  }

  await supabase
    .from("verti_loads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  refresh(id);
  redirect(`/verti-block/loads/${id}`);
}

export async function setLoadStatus(id: string, status: string) {
  await requireYard();
  const supabase = await createClient();
  await supabase
    .from("verti_loads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  refresh(id);
}

export async function deleteLoad(id: string) {
  await requireYard();
  const supabase = await createClient();
  await supabase.from("verti_loads").delete().eq("id", id);
  refresh();
  redirect("/verti-block/loads");
}
