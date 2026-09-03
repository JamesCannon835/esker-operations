"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orNull, friendlyDbError } from "@/lib/assets";
import { COMPLIANCE_TYPES, type ComplianceType } from "@/lib/compliance";

export type FormState = { error?: string };

function readItem(formData: FormData) {
  const assetRef = orNull(formData.get("asset"));
  const compliance_type = orNull(formData.get("compliance_type"));
  return {
    assetRef,
    compliance_type: compliance_type as ComplianceType | null,
    due_date: orNull(formData.get("due_date")),
    last_completed_date: orNull(formData.get("last_completed_date")),
    notes: orNull(formData.get("notes")),
  };
}

export async function createComplianceItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const v = readItem(formData);
  if (!v.assetRef || !v.assetRef.includes(":")) {
    return { error: "Choose the asset." };
  }
  if (!v.compliance_type || !COMPLIANCE_TYPES.includes(v.compliance_type)) {
    return { error: "Choose a compliance type." };
  }
  if (!v.due_date) return { error: "Due date is required." };

  const [asset_type, asset_id] = v.assetRef.split(":");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compliance_items")
    .insert({
      asset_type,
      asset_id,
      compliance_type: v.compliance_type,
      due_date: v.due_date,
      last_completed_date: v.last_completed_date,
      notes: v.notes,
    })
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/compliance");
  redirect("/compliance");
}

export async function updateComplianceItem(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const v = readItem(formData);
  if (!v.compliance_type || !v.due_date) {
    return { error: "Type and due date are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("compliance_items")
    .update({
      compliance_type: v.compliance_type,
      due_date: v.due_date,
      last_completed_date: v.last_completed_date,
      notes: v.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/compliance");
  redirect("/compliance");
}

/** Marks the current item done and rolls the due date forward. */
export async function completeComplianceItem(
  id: string,
  months: number,
  completedOn: string,
) {
  const supabase = await createClient();
  const next = new Date(completedOn);
  next.setMonth(next.getMonth() + months);
  const { error } = await supabase
    .from("compliance_items")
    .update({
      last_completed_date: completedOn,
      due_date: next.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(friendlyDbError(error.message));
  revalidatePath("/compliance");
}

export async function setComplianceVoided(id: string, voided: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compliance_items")
    .update({ voided, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendlyDbError(error.message));
  revalidatePath("/compliance");
  redirect("/compliance");
}
