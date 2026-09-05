"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";
import {
  VI_CHECKLIST_ID,
  formatInspectionNumber,
  type ViSeverity,
} from "@/lib/vehicle-inspection";
import {
  advanceThirteenWeek,
} from "@/lib/vehicle-inspection-server";

export type FormState = { error?: string; ok?: boolean };

async function requireWorkshop() {
  const { user, roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  return { user, roles };
}

function touch(id: string) {
  revalidatePath("/vehicle-inspections");
  revalidatePath(`/vehicle-inspections/${id}`);
  revalidatePath("/dashboard");
}

/** Pick a vehicle + odometer -> a draft inspection with a row per item. */
export async function startInspection(formData: FormData) {
  const { user } = await requireWorkshop();
  const vehicleId = orNull(formData.get("vehicle_id"));
  if (!vehicleId) redirect("/vehicle-inspections");
  const supabase = await createClient();

  const [{ data: v }, { data: items }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("current_mileage, current_hours")
      .eq("id", vehicleId)
      .maybeSingle(),
    supabase
      .from("inspection_checklist_items")
      .select("id, section, reference_code, item_name, sort_order")
      .eq("checklist_id", VI_CHECKLIST_ID)
      .eq("active", true)
      .order("sort_order"),
  ]);

  const now = new Date();
  const { data: insp, error } = await supabase
    .from("vehicle_inspections")
    .insert({
      checklist_id: VI_CHECKLIST_ID,
      vehicle_id: vehicleId,
      inspector_id: user.id,
      odometer: numOrNull(formData.get("odometer")) ?? v?.current_mileage ?? null,
      engine_hours: v?.current_hours ?? null,
      inspection_time: now.toTimeString().slice(0, 5),
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));

  if (items && items.length) {
    await supabase.from("vehicle_inspection_results").insert(
      items.map((it) => ({
        inspection_id: insp.id,
        checklist_item_id: it.id,
        section: it.section,
        reference_code: it.reference_code,
        item_name: it.item_name,
        sort_order: it.sort_order,
      })),
    );
  }

  revalidatePath("/vehicle-inspections");
  redirect(`/vehicle-inspections/${insp.id}`);
}

const RESULT_FIELDS = [
  "result",
  "defect_description",
  "severity",
  "safe_to_operate",
  "photo_path",
] as const;

/** One tap / field change on an inspection item. */
export async function setResult(
  inspectionId: string,
  resultId: string,
  patch: Record<string, unknown>,
): Promise<FormState> {
  await requireWorkshop();
  const supabase = await createClient();

  const { data: insp } = await supabase
    .from("vehicle_inspections")
    .select("status")
    .eq("id", inspectionId)
    .maybeSingle();
  if (!insp) return { error: "Inspection not found." };
  if (insp.status === "completed") {
    return { error: "This inspection is completed." };
  }

  const clean: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const k of RESULT_FIELDS) {
    if (k in patch) clean[k] = patch[k] === "" ? null : patch[k];
  }
  if (patch.result && patch.result !== "defect") {
    clean.defect_description = null;
    clean.severity = null;
    clean.safe_to_operate = null;
    clean.photo_path = null;
  }

  const { error } = await supabase
    .from("vehicle_inspection_results")
    .update(clean)
    .eq("id", resultId)
    .eq("inspection_id", inspectionId);
  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath(`/vehicle-inspections/${inspectionId}`);
  return { ok: true };
}

export async function saveInspectionMeta(
  inspectionId: string,
  patch: Record<string, unknown>,
): Promise<FormState> {
  await requireWorkshop();
  const supabase = await createClient();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of [
    "odometer",
    "notes",
    "service_done",
    "service_notes",
    "signature_confirmed",
  ]) {
    if (k in patch) clean[k] = patch[k] === "" ? null : patch[k];
  }
  const { error } = await supabase
    .from("vehicle_inspections")
    .update(clean)
    .eq("id", inspectionId)
    .eq("status", "draft");
  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath(`/vehicle-inspections/${inspectionId}`);
  return { ok: true };
}

async function nextInspectionNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("vehicle_inspections")
    .select("inspection_number")
    .like("inspection_number", `VIR-${year}-%`)
    .order("inspection_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let seq = 1;
  if (data?.inspection_number) {
    const n = Number(String(data.inspection_number).split("-").pop());
    if (Number.isFinite(n)) seq = n + 1;
  }
  return formatInspectionNumber(year, seq);
}

export async function completeInspection(
  id: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const { user } = await requireWorkshop();
  const supabase = await createClient();

  const { data: insp } = await supabase
    .from("vehicle_inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!insp) return { error: "Inspection not found." };
  if (insp.status === "completed") return { ok: true };

  const { data: results } = await supabase
    .from("vehicle_inspection_results")
    .select("*")
    .eq("inspection_id", id)
    .order("sort_order");
  const rows = results ?? [];

  const undone = rows.filter((r) => !r.result);
  if (undone.length > 0) {
    return {
      error: `${undone.length} item${undone.length === 1 ? "" : "s"} still to be checked.`,
    };
  }
  const badDefects = rows.filter(
    (r) =>
      r.result === "defect" &&
      (!orNull(r.defect_description) ||
        !r.severity ||
        r.safe_to_operate == null),
  );
  if (badDefects.length > 0) {
    return {
      error:
        "Every defect needs a description, a severity and a safe-to-operate answer.",
    };
  }
  if (!insp.signature_confirmed) {
    return { error: "Tick the confirmation before completing." };
  }
  if (insp.service_done && !orNull(insp.service_notes)) {
    return { error: "Add a note for the service, or set it to No." };
  }

  const number = await nextInspectionNumber(supabase);

  // Raise a fault for each defect.
  const defects = rows.filter((r) => r.result === "defect");
  for (const d of defects) {
    if (d.fault_id) continue;
    const ref = d.reference_code ? `${d.reference_code} — ` : "";
    const { data: fault } = await supabase
      .from("faults")
      .insert({
        asset_type: "vehicle",
        asset_id: insp.vehicle_id,
        reported_by: user.id,
        description: `Inspection ${ref}${d.item_name}: ${d.defect_description}`,
        severity: (d.severity as ViSeverity) ?? "normal",
        safe_to_operate: d.safe_to_operate !== false,
        status: "reported",
        source_vehicle_inspection_id: id,
        photo_url: d.photo_path
          ? `/vehicle-inspections/result/${d.id}/photo`
          : null,
      })
      .select("id")
      .single();
    if (fault) {
      await supabase
        .from("vehicle_inspection_results")
        .update({ fault_id: fault.id })
        .eq("id", d.id);
    }
  }

  const anyUnsafe = defects.some((d) => d.safe_to_operate === false);
  const result = anyUnsafe
    ? "out_of_service"
    : defects.length > 0
      ? "defects"
      : "passed";

  await supabase
    .from("vehicle_inspections")
    .update({
      status: "completed",
      inspection_number: number,
      result,
      out_of_service: anyUnsafe,
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (anyUnsafe) {
    await supabase
      .from("vehicles")
      .update({ status: "off_road", updated_at: new Date().toISOString() })
      .eq("id", insp.vehicle_id);
  }

  // A clean inspection advances the 13-week date straight away.
  if (result === "passed") {
    await advanceThirteenWeek(insp.vehicle_id, insp.inspection_date);
    revalidatePath("/compliance");
  }

  // Service logged during the inspection.
  if (insp.service_done) {
    await supabase.from("services").insert({
      asset_type: "vehicle",
      asset_id: insp.vehicle_id,
      service_date: insp.inspection_date,
      mileage_or_hours: insp.odometer,
      performed_by: user.id,
      notes: insp.service_notes,
    });
  }

  revalidatePath("/faults");
  touch(id);
  redirect(`/vehicle-inspections/${id}`);
}

export async function reopenInspection(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, roles } = await requireUser();
  if (!isManager(roles)) redirect("/dashboard");
  const reason = orNull(formData.get("reason"));
  if (!reason) return { error: "Give a reason for reopening." };

  const supabase = await createClient();
  const { data: insp } = await supabase
    .from("vehicle_inspections")
    .select("status, reopened_count")
    .eq("id", id)
    .maybeSingle();
  if (!insp || insp.status !== "completed")
    return { error: "Inspection is not completed." };

  await supabase
    .from("vehicle_inspections")
    .update({
      status: "draft",
      reopened_count: (insp.reopened_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  await supabase.from("audit_log").insert({
    table_name: "vehicle_inspections",
    record_id: id,
    action: "update",
    changed_by: user.id,
    old_value: { status: "completed" },
    new_value: { status: "draft", reason },
  });

  touch(id);
  return { ok: true };
}

export async function registerDefectPhoto(
  inspectionId: string,
  resultId: string,
  path: string,
) {
  return setResult(inspectionId, resultId, { photo_path: path });
}

/** Archive a vehicle inspection (admin / transport manager). */
export async function voidVehicleInspection(id: string) {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/dashboard");
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_inspections")
    .update({ voided: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vehicle-inspections");
  redirect("/vehicle-inspections");
}
