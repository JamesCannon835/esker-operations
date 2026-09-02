"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { LABOUR_TYPES, type LabourType } from "@/lib/inspections";

export type FormState = { error?: string };

async function client() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function refresh(id: string) {
  revalidatePath("/faults");
  revalidatePath(`/faults/${id}`);
}

export async function acceptFault(id: string) {
  const { supabase, user } = await client();
  const { error } = await supabase
    .from("faults")
    .update({ assigned_mechanic_id: user.id, status: "accepted" })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function assignFault(id: string, formData: FormData) {
  const { supabase } = await client();
  const mechanicId = orNull(formData.get("mechanic_id"));
  const { error } = await supabase
    .from("faults")
    .update({
      assigned_mechanic_id: mechanicId,
      status: mechanicId ? "accepted" : "reported",
    })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function saveDiagnosis(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await client();
  const diagnosis = orNull(formData.get("diagnosis"));
  const { data: current } = await supabase
    .from("faults")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const patch: Record<string, unknown> = { diagnosis };
  if (current?.status === "reported" || current?.status === "accepted") {
    patch.status = "in_progress";
  }

  const { error } = await supabase.from("faults").update(patch).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  refresh(id);
  return {};
}

export async function setFaultStatus(id: string, status: string) {
  const { supabase } = await client();
  const { error } = await supabase
    .from("faults")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function closeFault(id: string) {
  const { supabase, user } = await client();
  const { error } = await supabase
    .from("faults")
    .update({
      status: "closed",
      closed_by: user.id,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function reopenFault(id: string) {
  const { supabase } = await client();
  const { error } = await supabase
    .from("faults")
    .update({ status: "in_progress", closed_by: null, closed_at: null })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function startTimer(id: string, formData: FormData) {
  const { supabase, user } = await client();
  const rawType = String(formData.get("entry_type") ?? "repair");
  const entry_type: LabourType = LABOUR_TYPES.includes(rawType as LabourType)
    ? (rawType as LabourType)
    : "repair";

  const { data: running } = await supabase
    .from("labour_entries")
    .select("id")
    .eq("fault_id", id)
    .eq("mechanic_id", user.id)
    .is("stop_time", null)
    .maybeSingle();
  if (running) {
    refresh(id);
    return;
  }

  const { error } = await supabase.from("labour_entries").insert({
    fault_id: id,
    mechanic_id: user.id,
    start_time: new Date().toISOString(),
    entry_type,
  });
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function stopTimer(id: string, labourId: string) {
  const { supabase, user } = await client();
  const { error } = await supabase
    .from("labour_entries")
    .update({ stop_time: new Date().toISOString() })
    .eq("id", labourId)
    .eq("mechanic_id", user.id)
    .is("stop_time", null);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function deleteLabour(id: string, labourId: string) {
  const { supabase } = await client();
  const { error } = await supabase
    .from("labour_entries")
    .delete()
    .eq("id", labourId);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function addPart(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await client();
  const part_name = orNull(formData.get("part_name"));
  if (!part_name) return { error: "Part name is required." };

  const { error } = await supabase.from("parts_used").insert({
    fault_id: id,
    part_name,
    part_number: orNull(formData.get("part_number")),
    quantity: numOrNull(formData.get("quantity")) ?? 1,
    unit_cost: numOrNull(formData.get("unit_cost")),
    supplier: orNull(formData.get("supplier")),
  });
  if (error) return { error: friendlyDbError(error.message) };
  refresh(id);
  return {};
}

export async function deletePart(id: string, partId: string) {
  const { supabase } = await client();
  const { error } = await supabase.from("parts_used").delete().eq("id", partId);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}
