// Vehicle Maintenance Report — shared constants.

export const MR_REASONS = [
  "driver_fault",
  "daily_check_defect",
  "scheduled",
  "service",
  "thirteen_week_repair",
  "cvrt_prep",
  "breakdown",
  "preventative",
  "damage_repair",
  "management_request",
  "other",
] as const;
export type MrReason = (typeof MR_REASONS)[number];

export const MR_REASON_LABELS: Record<MrReason, string> = {
  driver_fault: "Driver reported fault",
  daily_check_defect: "Daily vehicle check defect",
  scheduled: "Scheduled maintenance",
  service: "Service",
  thirteen_week_repair: "13-week inspection repair",
  cvrt_prep: "CVRT / test preparation",
  breakdown: "Breakdown",
  preventative: "Preventative maintenance",
  damage_repair: "Damage repair",
  management_request: "Management request",
  other: "Other",
};

export const MR_VEHICLE_STATUS = [
  "safe",
  "safe_monitor",
  "not_safe",
  "awaiting_parts",
  "awaiting_external",
  "further_investigation",
] as const;
export type MrVehicleStatus = (typeof MR_VEHICLE_STATUS)[number];

export const MR_VEHICLE_STATUS_LABELS: Record<MrVehicleStatus, string> = {
  safe: "Safe to return to service",
  safe_monitor: "Safe — monitoring required",
  not_safe: "NOT safe to operate",
  awaiting_parts: "Awaiting parts",
  awaiting_external: "Awaiting external repair",
  further_investigation: "Further investigation required",
};

/** Statuses that keep the vehicle off the road and the linked fault open. */
export const MR_STATUS_BLOCKS_CLOSE: MrVehicleStatus[] = [
  "not_safe",
  "awaiting_parts",
  "awaiting_external",
  "further_investigation",
];

export const MR_OUT_OF_SERVICE: MrVehicleStatus[] = ["not_safe"];

export const WORK_CATEGORIES = [
  "Brakes",
  "Tyres & wheels",
  "Steering & suspension",
  "Electrical & lights",
  "Engine",
  "Transmission & driveline",
  "Air system",
  "Bodywork & cab",
  "Hydraulics",
  "Exhaust & emissions",
  "Trailer / coupling",
  "Other",
] as const;

export const MR_ATTACHMENT_KINDS = [
  "before",
  "after",
  "damage",
  "part",
  "supplier_doc",
  "invoice",
  "other",
] as const;
export type MrAttachmentKind = (typeof MR_ATTACHMENT_KINDS)[number];

export const MR_ATTACHMENT_KIND_LABELS: Record<MrAttachmentKind, string> = {
  before: "Before",
  after: "After",
  damage: "Damaged component",
  part: "Part",
  supplier_doc: "Supplier document",
  invoice: "Invoice",
  other: "Other",
};

export const ACTION_PRIORITIES = ["critical", "high", "normal", "low"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export const ACTION_PRIORITY_LABELS: Record<ActionPriority, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export const MAINTENANCE_BUCKET = "documents";
export const MAINTENANCE_PREFIX = "maintenance";

/** VMR-2026-0001 from a year and a sequence number. */
export function formatReportNumber(year: number, seq: number): string {
  return `VMR-${year}-${String(seq).padStart(4, "0")}`;
}

export function minutesToHm(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}
