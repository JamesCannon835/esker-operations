export type BreakdownRow = {
  reported_at: string;
  mechanic_notified_at: string | null;
  mechanic_arrived_at: string | null;
  repair_completed_at: string | null;
  returned_to_service_at: string | null;
};

export type BreakdownStage =
  | "reported"
  | "notified"
  | "on_site"
  | "repaired"
  | "back_in_service";

export const BREAKDOWN_STAGE_LABELS: Record<BreakdownStage, string> = {
  reported: "Reported",
  notified: "Mechanic notified",
  on_site: "Mechanic on site",
  repaired: "Repaired",
  back_in_service: "Back in service",
};

export function breakdownStage(b: BreakdownRow): BreakdownStage {
  if (b.returned_to_service_at) return "back_in_service";
  if (b.repair_completed_at) return "repaired";
  if (b.mechanic_arrived_at) return "on_site";
  if (b.mechanic_notified_at) return "notified";
  return "reported";
}

/** The timestamp column set by advancing from the current stage. */
export const NEXT_STEP: Record<
  BreakdownStage,
  { column: string; label: string } | null
> = {
  reported: { column: "mechanic_notified_at", label: "Mechanic notified" },
  notified: { column: "mechanic_arrived_at", label: "Mechanic on site" },
  on_site: { column: "repair_completed_at", label: "Repair complete" },
  repaired: { column: "returned_to_service_at", label: "Back in service" },
  back_in_service: null,
};

/** Downtime in ms, or null if not yet back in service. */
export function downtimeMs(b: BreakdownRow): number | null {
  if (!b.returned_to_service_at) return null;
  return (
    new Date(b.returned_to_service_at).getTime() -
    new Date(b.reported_at).getTime()
  );
}

export function formatDowntime(ms: number | null): string {
  if (ms == null) return "ongoing";
  const totalMin = Math.round(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}
