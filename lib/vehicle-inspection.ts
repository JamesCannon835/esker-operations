// Vehicle Inspection & Rectification Report — shared constants.

export const VI_CHECKLIST_ID = "55555555-0000-0000-0000-0000000000a1";
export const VI_RECURRING_DAYS = 91; // 13 weeks

export const VI_RESULTS = ["ok", "defect", "na"] as const;
export type ViResult = (typeof VI_RESULTS)[number];
export const VI_RESULT_LABELS: Record<ViResult, string> = {
  ok: "OK",
  defect: "Defect",
  na: "N/A",
};

// Defect severity — maps straight onto fault severity (no "monitor").
export const VI_SEVERITIES = ["critical", "urgent", "normal"] as const;
export type ViSeverity = (typeof VI_SEVERITIES)[number];
export const VI_SEVERITY_LABELS: Record<ViSeverity, string> = {
  critical: "Critical",
  urgent: "Urgent",
  normal: "Normal",
};

export const VI_STATUS_LABELS: Record<string, string> = {
  draft: "In progress",
  passed: "Passed",
  defects: "Defects found",
  rectification: "Rectification required",
  out_of_service: "Out of service",
};

export const VI_BUCKET = "documents";
export const VI_PREFIX = "inspections";

/** VIR-2026-0001 */
export function formatInspectionNumber(year: number, seq: number): string {
  return `VIR-${year}-${String(seq).padStart(4, "0")}`;
}
