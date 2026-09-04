"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import {
  MR_STATUS_BLOCKS_CLOSE,
  MR_OUT_OF_SERVICE,
  formatReportNumber,
  type MrVehicleStatus,
} from "@/lib/maintenance";

export type FormState = { error?: string; ok?: boolean };

async function requireWorkshop() {
  const { user, roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  return { user, roles };
}

function touch(id: string) {
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
}

/** Start a draft report — standalone (vehicleId) or from a fault (faultId). */
export async function createReport(opts: {
  vehicleId?: string;
  faultId?: string;
}) {
  const { user } = await requireWorkshop();
  const supabase = await createClient();

  let vehicleId = opts.vehicleId ?? null;
  let faultId = opts.faultId ?? null;
  let sourceInspectionId: string | null = null;
  let issue = "";
  const reasons: string[] = [];

  if (faultId) {
    const { data: f } = await supabase
      .from("faults")
      .select("asset_type, asset_id, description, source_inspection_id")
      .eq("id", faultId)
      .maybeSingle();
    if (f && f.asset_type === "vehicle") {
      vehicleId = f.asset_id;
      sourceInspectionId = f.source_inspection_id;
      issue = f.description ?? "";
      reasons.push(f.source_inspection_id ? "daily_check_defect" : "driver_fault");
    } else {
      faultId = null;
    }
  }
  if (!vehicleId) redirect("/maintenance");

  // Don't create a second draft for the same fault — reuse it.
  if (faultId) {
    const { data: existing } = await supabase
      .from("maintenance_reports")
      .select("id")
      .eq("fault_id", faultId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) redirect(`/maintenance/${existing.id}`);
  }

  const { data: v } = await supabase
    .from("vehicles")
    .select("current_mileage, current_hours")
    .eq("id", vehicleId)
    .maybeSingle();

  const now = new Date();
  const { data: report, error } = await supabase
    .from("maintenance_reports")
    .insert({
      vehicle_id: vehicleId,
      fault_id: faultId,
      source_inspection_id: sourceInspectionId,
      report_time: now.toTimeString().slice(0, 5),
      mileage: v?.current_mileage ?? null,
      engine_hours: v?.current_hours ?? null,
      reasons,
      issue_description: issue || null,
      created_by: user.id,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));

  // Pull any labour already logged against the fault.
  if (faultId) {
    const { data: labour } = await supabase
      .from("labour_entries")
      .select("id, mechanic_id, start_time, stop_time")
      .eq("fault_id", faultId);
    const rows = (labour ?? [])
      .filter((l) => l.stop_time)
      .map((l) => ({
        report_id: report.id,
        mechanic_id: l.mechanic_id,
        minutes: Math.round(
          (new Date(l.stop_time!).getTime() -
            new Date(l.start_time).getTime()) /
            60000,
        ),
        from_fault_labour_id: l.id,
      }))
      .filter((r) => r.minutes > 0);
    if (rows.length) await supabase.from("maintenance_labour").insert(rows);
  }

  revalidatePath("/maintenance");
  redirect(`/maintenance/${report.id}`);
}

/** Called from a fault — create or reopen its maintenance report. */
export async function openReportForFault(faultId: string) {
  await createReport({ faultId });
}

/** FormData wrapper for the "start a report" pages. */
export async function startReport(formData: FormData) {
  const vehicleId = orNull(formData.get("vehicle_id"));
  const faultId = orNull(formData.get("fault_id"));
  await createReport({
    vehicleId: vehicleId ?? undefined,
    faultId: faultId ?? undefined,
  });
}

const EDITABLE = [
  "report_time",
  "mileage",
  "engine_hours",
  "reasons",
  "issue_description",
  "work_summary",
  "notes",
  "vehicle_status",
  "signature_confirmed",
  "followup_required",
  "followup_detail",
  "followup_priority",
  "followup_assigned_to",
  "followup_due_date",
] as const;

/** Autosave from the editor. `patch` is a plain object of changed fields. */
export async function saveReportFields(
  id: string,
  patch: Record<string, unknown>,
): Promise<FormState> {
  await requireWorkshop();
  const supabase = await createClient();

  const { data: cur } = await supabase
    .from("maintenance_reports")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return { error: "Report not found." };
  if (cur.status === "completed") {
    return { error: "This report is completed and can't be changed." };
  }

  const clean: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const k of EDITABLE) {
    if (k in patch) clean[k] = patch[k] === "" ? null : patch[k];
  }

  const { error } = await supabase
    .from("maintenance_reports")
    .update(clean)
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath(`/maintenance/${id}`);
  return { ok: true };
}

// ---- work items ----
export async function addWorkItem(reportId: string, formData: FormData) {
  await requireWorkshop();
  const description = orNull(formData.get("description"));
  if (!description) return;
  const supabase = await createClient();
  await supabase.from("maintenance_work_items").insert({
    report_id: reportId,
    description,
    category: orNull(formData.get("category")),
    completed: formData.get("completed") !== "no",
    labour_minutes: numOrNull(formData.get("labour_minutes")),
  });
  touch(reportId);
}

export async function removeWorkItem(reportId: string, itemId: string) {
  await requireWorkshop();
  const supabase = await createClient();
  await supabase.from("maintenance_work_items").delete().eq("id", itemId);
  touch(reportId);
}

// ---- parts ----
export async function addPart(reportId: string, formData: FormData) {
  await requireWorkshop();
  const description = orNull(formData.get("description"));
  if (!description) return;
  const supabase = await createClient();
  await supabase.from("maintenance_parts").insert({
    report_id: reportId,
    description,
    part_number: orNull(formData.get("part_number")),
    quantity: numOrNull(formData.get("quantity")) ?? 1,
    supplier: orNull(formData.get("supplier")),
    unit_cost: numOrNull(formData.get("unit_cost")),
  });
  touch(reportId);
}

export async function removePart(reportId: string, partId: string) {
  await requireWorkshop();
  const supabase = await createClient();
  await supabase.from("maintenance_parts").delete().eq("id", partId);
  touch(reportId);
}

// ---- labour ----
export async function addLabour(reportId: string, formData: FormData) {
  const { user } = await requireWorkshop();
  const hours = Math.max(0, Math.floor(Number(formData.get("hours") ?? 0)));
  const mins = Math.max(0, Math.min(59, Math.floor(Number(formData.get("minutes") ?? 0))));
  const total = hours * 60 + mins;
  if (total <= 0) return;
  const supabase = await createClient();
  const who = orNull(formData.get("mechanic_id")) ?? user.id;
  await supabase.from("maintenance_labour").insert({
    report_id: reportId,
    mechanic_id: who,
    minutes: total,
    work_date: orNull(formData.get("work_date")) ?? new Date().toISOString().slice(0, 10),
  });
  touch(reportId);
}

export async function removeLabour(reportId: string, labourId: string) {
  await requireWorkshop();
  const supabase = await createClient();
  await supabase.from("maintenance_labour").delete().eq("id", labourId);
  touch(reportId);
}

// ---- complete / reopen ----
async function nextReportNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("maintenance_reports")
    .select("report_number")
    .like("report_number", `VMR-${year}-%`)
    .order("report_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let seq = 1;
  if (data?.report_number) {
    const n = Number(String(data.report_number).split("-").pop());
    if (Number.isFinite(n)) seq = n + 1;
  }
  return formatReportNumber(year, seq);
}

export async function completeReport(
  id: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const { user } = await requireWorkshop();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("maintenance_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!r) return { error: "Report not found." };
  if (r.status === "completed") return { ok: true };

  if (!r.vehicle_status) {
    return { error: "Choose the vehicle status after repair before completing." };
  }
  if (!r.signature_confirmed) {
    return { error: "Tick the confirmation before completing." };
  }
  if (r.followup_required && !orNull(r.followup_detail)) {
    return { error: "Describe the follow-up work, or set follow-up to No." };
  }

  const report_number = await nextReportNumber(supabase);
  const status = r.vehicle_status as MrVehicleStatus;

  // Follow-up -> a central Action.
  let followup_action_id: string | null = r.followup_action_id ?? null;
  if (r.followup_required && !followup_action_id) {
    const { data: action } = await supabase
      .from("actions")
      .insert({
        entity_type: "maintenance_report",
        entity_id: id,
        source: "maintenance_followup",
        title: r.followup_detail,
        priority: r.followup_priority ?? "normal",
        assigned_to: r.followup_assigned_to ?? null,
        raised_by: user.id,
        due_date: r.followup_due_date ?? null,
        status: "open",
      })
      .select("id")
      .single();
    followup_action_id = action?.id ?? null;
  }

  const { error } = await supabase
    .from("maintenance_reports")
    .update({
      status: "completed",
      report_number,
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      followup_action_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  // Vehicle roadworthiness.
  if (MR_OUT_OF_SERVICE.includes(status)) {
    await supabase
      .from("vehicles")
      .update({ status: "off_road", updated_at: new Date().toISOString() })
      .eq("id", r.vehicle_id);
  } else if (status === "safe" || status === "safe_monitor") {
    await supabase
      .from("vehicles")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .eq("id", r.vehicle_id)
      .in("status", ["off_road", "maintenance", "breakdown"]);
  }

  // Linked fault: close only if the vehicle is safe and nothing outstanding.
  if (r.fault_id) {
    const blocks =
      MR_STATUS_BLOCKS_CLOSE.includes(status) || r.followup_required;
    if (blocks) {
      await supabase
        .from("faults")
        .update({ status: "in_progress", diagnosis: r.work_summary ?? null })
        .eq("id", r.fault_id);
    } else {
      await supabase
        .from("faults")
        .update({
          status: "closed",
          closed_by: user.id,
          closed_at: new Date().toISOString(),
          diagnosis: r.work_summary ?? null,
        })
        .eq("id", r.fault_id);
    }
    revalidatePath(`/faults/${r.fault_id}`);
    revalidatePath("/faults");
  }

  touch(id);
  redirect(`/maintenance/${id}`);
}

export async function reopenReport(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, roles } = await requireUser();
  if (!isManager(roles)) redirect("/dashboard");
  const reason = orNull(formData.get("reason"));
  if (!reason) return { error: "Give a reason for reopening." };

  const supabase = await createClient();
  const { data: r } = await supabase
    .from("maintenance_reports")
    .select("status, reopened_count")
    .eq("id", id)
    .maybeSingle();
  if (!r || r.status !== "completed") return { error: "Report is not completed." };

  const { error } = await supabase
    .from("maintenance_reports")
    .update({
      status: "draft",
      reopened_count: (r.reopened_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  await supabase.from("audit_log").insert({
    table_name: "maintenance_reports",
    record_id: id,
    action: "update",
    changed_by: user.id,
    old_value: { status: "completed" },
    new_value: { status: "draft", reason },
  });

  touch(id);
  return { ok: true };
}
