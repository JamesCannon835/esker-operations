"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/auth";
import { orNull, friendlyDbError } from "@/lib/assets";
import { ASSET_TYPES, type AssetTypeT } from "@/lib/inspections";

export type FormState = { error?: string };

// Checklists are managed by admin + transport managers only.
async function guard() {
  await requireManager();
}

function readTemplate(formData: FormData) {
  const asset_type = orNull(formData.get("asset_type"));
  return {
    name: orNull(formData.get("name")),
    asset_type: asset_type as AssetTypeT | null,
    category: orNull(formData.get("category")),
  };
}

export async function createTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await guard();
  const values = readTemplate(formData);
  if (!values.name || !values.asset_type) {
    return { error: "Name and asset type are required." };
  }
  if (!ASSET_TYPES.includes(values.asset_type)) {
    return { error: "Invalid asset type." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspection_templates")
    .insert(values)
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/checklists");
  redirect(`/checklists/${data.id}`);
}

export async function updateTemplate(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await guard();
  const values = readTemplate(formData);
  if (!values.name || !values.asset_type) {
    return { error: "Name and asset type are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("inspection_templates")
    .update(values)
    .eq("id", id);

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/checklists");
  revalidatePath(`/checklists/${id}`);
  return {};
}

export async function addItem(templateId: string, formData: FormData) {
  await guard();
  const item_name = orNull(formData.get("item_name"));
  if (!item_name) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("inspection_template_items")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.sort_order ?? 0) + 10;

  await supabase
    .from("inspection_template_items")
    .insert({ template_id: templateId, item_name, sort_order: nextOrder });

  revalidatePath(`/checklists/${templateId}`);
}

export async function renameItem(templateId: string, formData: FormData) {
  await guard();
  const id = orNull(formData.get("item_id"));
  const item_name = orNull(formData.get("item_name"));
  if (!id || !item_name) return;

  const supabase = await createClient();
  await supabase
    .from("inspection_template_items")
    .update({ item_name })
    .eq("id", id);

  revalidatePath(`/checklists/${templateId}`);
}

export async function deleteItem(templateId: string, itemId: string) {
  await guard();
  const supabase = await createClient();
  await supabase.from("inspection_template_items").delete().eq("id", itemId);
  revalidatePath(`/checklists/${templateId}`);
}

export async function moveItem(
  templateId: string,
  itemId: string,
  direction: "up" | "down",
) {
  await guard();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("inspection_template_items")
    .select("id, sort_order")
    .eq("template_id", templateId)
    .order("sort_order");

  if (!items) return;
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return;

  const a = items[idx];
  const b = items[swapIdx];

  await supabase
    .from("inspection_template_items")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  await supabase
    .from("inspection_template_items")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);

  revalidatePath(`/checklists/${templateId}`);
}

export async function deleteTemplate(id: string) {
  await guard();
  const supabase = await createClient();
  const { error } = await supabase
    .from("inspection_templates")
    .delete()
    .eq("id", id);

  if (error) throw new Error(friendlyDbError(error.message));

  revalidatePath("/checklists");
  redirect("/checklists");
}
