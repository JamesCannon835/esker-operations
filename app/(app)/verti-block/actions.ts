"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { mondayOf, dateForWeekday } from "@/lib/verti-block";

export type FormState = { error?: string };

async function requireYard() {
  const s = await requireUser();
  if (!hasRole(s.roles, "plant_operator") && !isManager(s.roles)) {
    redirect("/dashboard");
  }
  return s;
}

async function requireVbManager() {
  const s = await requireUser();
  if (!isManager(s.roles)) redirect("/verti-block");
  return s;
}

function refresh(weekId?: string) {
  revalidatePath("/verti-block");
  if (weekId) revalidatePath(`/verti-block/${weekId}`);
}

// ---- weeks -------------------------------------------------------
export async function createWeek(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireYard();
  const supabase = await createClient();

  const raw = orNull(formData.get("week_commencing"));
  if (!raw) return { error: "Pick a week." };
  const monday = mondayOf(new Date(`${raw}T00:00:00`));

  const { data: existing } = await supabase
    .from("verti_production_weeks")
    .select("id")
    .eq("week_commencing", monday)
    .maybeSingle();
  if (existing) redirect(`/verti-block/${existing.id}`);

  const { data: week, error } = await supabase
    .from("verti_production_weeks")
    .insert({
      week_commencing: monday,
      operator_name: orNull(formData.get("operator_name")),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };

  await supabase.from("verti_production_days").insert(
    [1, 2, 3, 4, 5].map((wd) => ({
      week_id: week.id,
      weekday: wd,
      day_date: dateForWeekday(monday, wd),
    })),
  );

  refresh(week.id);
  redirect(`/verti-block/${week.id}`);
}

export async function saveWeek(
  weekId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireYard();
  const supabase = await createClient();

  const { data: types } = await supabase
    .from("verti_block_types")
    .select("id");
  const typeIds = (types ?? []).map((t) => t.id);

  await supabase
    .from("verti_production_weeks")
    .update({
      operator_name: orNull(formData.get("operator_name")),
      notes: orNull(formData.get("notes")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", weekId);

  const tick = (v: FormDataEntryValue | null) =>
    v === "yes" ? true : v === "no" ? false : null;

  for (const wd of [1, 2, 3, 4, 5]) {
    const counts: Record<string, number> = {};
    for (const tid of typeIds) {
      const n = numOrNull(formData.get(`d${wd}_c_${tid}`));
      if (n != null && n !== 0) counts[tid] = n;
    }
    await supabase
      .from("verti_production_days")
      .update({
        concrete_ordered_m3: numOrNull(formData.get(`d${wd}_concrete`)),
        counts,
        blocks_broken: orNull(formData.get(`d${wd}_broken`)),
        block_visual_ok: tick(formData.get(`d${wd}_bv`)),
        mould_visual_ok: tick(formData.get(`d${wd}_mv`)),
        weight_ok: tick(formData.get(`d${wd}_wt`)),
        updated_at: new Date().toISOString(),
      })
      .eq("week_id", weekId)
      .eq("weekday", wd);
  }

  refresh(weekId);
  redirect(`/verti-block/${weekId}`);
}

export async function deleteWeek(id: string) {
  await requireVbManager();
  const supabase = await createClient();
  await supabase.from("verti_production_weeks").delete().eq("id", id);
  refresh();
  redirect("/verti-block");
}

// ---- block types (manager) ------------------------------------
export async function saveType(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireVbManager();
  const supabase = await createClient();
  const name = orNull(formData.get("name"));
  if (!name) return { error: "Enter a name." };
  const row = {
    name,
    sort_order: numOrNull(formData.get("sort_order")) ?? 100,
    weight_kg: numOrNull(formData.get("weight_kg")),
    active: formData.get("active") !== null,
  };
  const { error } = id
    ? await supabase.from("verti_block_types").update(row).eq("id", id)
    : await supabase.from("verti_block_types").insert(row);
  if (error) return { error: friendlyDbError(error.message) };
  refresh();
  redirect("/verti-block/types");
}

export async function deleteType(id: string) {
  await requireVbManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("verti_block_types")
    .delete()
    .eq("id", id);
  if (error) {
    await supabase
      .from("verti_block_types")
      .update({ active: false })
      .eq("id", id);
  }
  refresh();
  redirect("/verti-block/types");
}
