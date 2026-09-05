"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import { workingDaysBetween, LEAVE_TYPES, type LeaveType } from "@/lib/leave";

export type FormState = { error?: string; ok?: string };

function refresh(userId?: string) {
  revalidatePath("/leave");
  revalidatePath("/leave/approvals");
  revalidatePath("/leave/calendar");
  revalidatePath("/leave/allowances");
  if (userId) revalidatePath(`/leave/person/${userId}`);
  revalidatePath("/dashboard");
}

function readType(v: FormDataEntryValue | null): LeaveType {
  const s = String(v ?? "annual");
  return (LEAVE_TYPES as readonly string[]).includes(s)
    ? (s as LeaveType)
    : "annual";
}

/** A person books their own time off — always starts as "awaiting approval". */
export async function requestLeave(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireUser();
  const supabase = await createClient();

  const start_date = orNull(formData.get("start_date"));
  const end_date = orNull(formData.get("end_date"));
  const leave_type = readType(formData.get("leave_type"));
  const reason = orNull(formData.get("reason"));

  if (!start_date || !end_date) return { error: "Pick a start and end date." };
  if (end_date < start_date)
    return { error: "The end date can't be before the start date." };

  const working_days = workingDaysBetween(start_date, end_date);
  if (working_days === 0)
    return { error: "That range is all weekend — nothing to book." };

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    leave_type,
    start_date,
    end_date,
    working_days,
    reason,
    status: "pending",
    created_by: user.id,
  });
  if (error) return { error: friendlyDbError(error.message) };

  refresh(user.id);
  redirect("/leave");
}

/** A manager records time off for someone else — approved straight away. */
export async function bookForSomeone(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, roles } = await requireUser();
  if (!isManager(roles)) redirect("/dashboard");
  const supabase = await createClient();

  const user_id = orNull(formData.get("user_id"));
  const start_date = orNull(formData.get("start_date"));
  const end_date = orNull(formData.get("end_date"));
  const leave_type = readType(formData.get("leave_type"));
  const reason = orNull(formData.get("reason"));

  if (!user_id) return { error: "Choose the person." };
  if (!start_date || !end_date) return { error: "Pick a start and end date." };
  if (end_date < start_date)
    return { error: "The end date can't be before the start date." };

  const working_days = workingDaysBetween(start_date, end_date);
  if (working_days === 0)
    return { error: "That range is all weekend — nothing to book." };

  const { error } = await supabase.from("leave_requests").insert({
    user_id,
    leave_type,
    start_date,
    end_date,
    working_days,
    reason,
    status: "approved",
    decided_by: user.id,
    decided_at: new Date().toISOString(),
    created_by: user.id,
  });
  if (error) return { error: friendlyDbError(error.message) };

  refresh(user_id);
  redirect("/leave/approvals");
}

/** Approve or decline a pending request (managers only). */
export async function decideLeave(id: string, formData: FormData) {
  const { user, roles } = await requireUser();
  if (!isManager(roles)) redirect("/dashboard");
  const supabase = await createClient();

  const decision = String(formData.get("decision"));
  if (decision !== "approved" && decision !== "rejected") {
    redirect("/leave/approvals");
  }

  const { data: row, error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: orNull(formData.get("note")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("user_id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));

  refresh(row.user_id);
  redirect("/leave/approvals");
}

/** Cancel a request. The person can cancel their own; managers can cancel any. */
export async function cancelLeave(id: string) {
  const { user, roles } = await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("leave_requests")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) redirect("/leave");
  if (existing.user_id !== user.id && !isManager(roles)) redirect("/leave");

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));

  refresh(existing.user_id);
}

/** Set (or clear) a person's annual entitlement. Blank = fall back to the company default. */
export async function setAllowance(userId: string, formData: FormData) {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/dashboard");
  const supabase = await createClient();

  const days = numOrNull(formData.get("annual_days"));
  if (days == null) {
    await supabase.from("leave_allowances").delete().eq("user_id", userId);
  } else {
    await supabase.from("leave_allowances").upsert(
      {
        user_id: userId,
        annual_days: days,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }
  refresh(userId);
}
