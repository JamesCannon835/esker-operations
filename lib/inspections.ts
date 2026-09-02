export const ASSET_TYPES = ["vehicle", "plant", "trailer"] as const;
export type AssetTypeT = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetTypeT, string> = {
  vehicle: "Vehicle",
  plant: "Plant",
  trailer: "Trailer",
};

export const ITEM_RESULTS = ["pass", "fail", "na"] as const;
export type ItemResult = (typeof ITEM_RESULTS)[number];

export const ITEM_RESULT_LABELS: Record<ItemResult, string> = {
  pass: "Pass",
  fail: "Fail",
  na: "N/A",
};

/** inspection_type for a daily check of the given asset type. */
export function dailyInspectionType(assetType: AssetTypeT): string {
  return assetType === "plant" ? "daily_plant" : "daily_vehicle";
}

/** "mileage" for vehicles/trailers, "hours" for plant. */
export function readingLabel(assetType: AssetTypeT): string {
  return assetType === "plant" ? "Current hours" : "Current mileage (km)";
}

export const FAULT_SEVERITIES = [
  "critical",
  "urgent",
  "normal",
  "monitor",
] as const;
export type FaultSeverity = (typeof FAULT_SEVERITIES)[number];

export const FAULT_SEVERITY_LABELS: Record<FaultSeverity, string> = {
  critical: "Critical — do not use",
  urgent: "Urgent — fix today",
  normal: "Normal",
  monitor: "Monitor",
};

export const FAULT_STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  accepted: "Accepted",
  in_progress: "In progress",
  awaiting_parts: "Awaiting parts",
  completed: "Completed",
  closed: "Closed",
};
