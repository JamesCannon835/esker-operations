import "server-only";
import { createClient } from "@/lib/supabase/server";
import { VI_RECURRING_DAYS } from "@/lib/vehicle-inspection";

/**
 * Push the vehicle's 13-week inspection due date to `fromDate` + 13 weeks.
 * `fromDate` is the date the inspection was carried out (the legal clock
 * starts then, not when the last defect was rectified). Defaults to today.
 */
export async function advanceThirteenWeek(
  vehicleId: string,
  fromDate?: string,
) {
  const supabase = await createClient();
  const base = fromDate ? new Date(fromDate) : new Date();
  const due = new Date(base);
  due.setDate(due.getDate() + VI_RECURRING_DAYS);
  const todayStr = base.toISOString().slice(0, 10);
  const dueStr = due.toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("compliance_items")
    .select("id")
    .eq("asset_type", "vehicle")
    .eq("asset_id", vehicleId)
    .eq("compliance_type", "thirteen_week_inspection")
    .eq("voided", false)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("compliance_items")
      .update({
        due_date: dueStr,
        last_completed_date: todayStr,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("compliance_items").insert({
      asset_type: "vehicle",
      asset_id: vehicleId,
      compliance_type: "thirteen_week_inspection",
      due_date: dueStr,
      last_completed_date: todayStr,
      voided: false,
    });
  }
}

/**
 * Re-derive an inspection's result from the state of the faults it raised.
 * Called when one of those faults is closed. When every defect is rectified,
 * the inspection flips to "passed", the 13-week date advances, and the
 * vehicle comes back into service if nothing else is holding it off the road.
 */
export async function refreshInspectionFromFaults(inspectionId: string) {
  const supabase = await createClient();

  const { data: insp } = await supabase
    .from("vehicle_inspections")
    .select("id, vehicle_id, status, result, out_of_service, inspection_date")
    .eq("id", inspectionId)
    .maybeSingle();
  if (!insp || insp.status !== "completed") return;

  const { data: results } = await supabase
    .from("vehicle_inspection_results")
    .select("result, safe_to_operate, fault_id")
    .eq("inspection_id", inspectionId)
    .eq("result", "defect");
  const defects = results ?? [];
  if (defects.length === 0) return;

  const faultIds = defects.map((d) => d.fault_id).filter(Boolean) as string[];
  const { data: faults } = faultIds.length
    ? await supabase.from("faults").select("id, status").in("id", faultIds)
    : { data: [] as { id: string; status: string }[] };
  const closed = new Set(
    (faults ?? []).filter((f) => f.status === "closed").map((f) => f.id),
  );

  const openDefects = defects.filter(
    (d) => !d.fault_id || !closed.has(d.fault_id),
  );
  const anyUnsafeOpen = openDefects.some((d) => d.safe_to_operate === false);

  let result: string;
  if (openDefects.length === 0) result = "passed";
  else if (anyUnsafeOpen) result = "out_of_service";
  else result = "defects";

  const outOfService = result === "out_of_service";

  await supabase
    .from("vehicle_inspections")
    .update({
      result,
      out_of_service: outOfService,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inspectionId);

  if (result === "passed") {
    await advanceThirteenWeek(insp.vehicle_id, insp.inspection_date);
    // Bring the vehicle back if this inspection was what took it off the road.
    if (insp.out_of_service) {
      await supabase
        .from("vehicles")
        .update({ status: "available", updated_at: new Date().toISOString() })
        .eq("id", insp.vehicle_id)
        .eq("status", "off_road");
    }
  }
}
