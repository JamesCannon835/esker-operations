export const COMPLIANCE_TYPES = [
  "tax",
  "cvrt_test",
  "insurance",
  "thirteen_week_inspection",
  "tacho_calibration",
  "service",
  "other",
] as const;

export type ComplianceType = (typeof COMPLIANCE_TYPES)[number];

export const COMPLIANCE_TYPE_LABELS: Record<ComplianceType, string> = {
  tax: "Motor tax",
  cvrt_test: "CVRT test",
  insurance: "Insurance",
  thirteen_week_inspection: "Inspection",
  tacho_calibration: "Tachograph calibration",
  service: "Service",
  other: "Other",
};

/** Which compliance date types apply to each asset type. */
export const COMPLIANCE_COLUMNS: Record<
  "vehicle" | "plant" | "trailer",
  ComplianceType[]
> = {
  vehicle: [
    "tax",
    "cvrt_test",
    "insurance",
    "thirteen_week_inspection",
    "tacho_calibration",
    "service",
  ],
  trailer: ["tax", "cvrt_test", "insurance", "thirteen_week_inspection"],
  plant: ["insurance", "service"],
};

export type ComplianceStatus = "red" | "amber" | "green";

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  red: "Overdue",
  amber: "Due soon",
  green: "OK",
};

/** amber = due within this many days */
export const AMBER_WINDOW_DAYS = 14;

export function complianceStatus(
  dueDate: string | Date,
  windowDays = AMBER_WINDOW_DAYS,
): ComplianceStatus {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const window = new Date(today);
  window.setDate(window.getDate() + windowDays);

  if (due < today) return "red";
  if (due <= window) return "amber";
  return "green";
}

/** Days until due (negative if overdue). */
export function daysUntil(dueDate: string | Date): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export const STATUS_ORDER: Record<ComplianceStatus, number> = {
  red: 0,
  amber: 1,
  green: 2,
};
