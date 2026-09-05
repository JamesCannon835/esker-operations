export const LEAVE_TYPES = ["annual", "sick"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
};

export const LEAVE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Declined",
  cancelled: "Cancelled",
};

/** Fallback entitlement when a person has no allowance row and no company default set. */
export const DEFAULT_ANNUAL_DAYS = 21;

export type LeaveRequest = {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string | null;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
};

/** Count Mon–Fri days in the inclusive range. Returns 0 for an invalid range. */
export function workingDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }
  let days = 0;
  const d = new Date(start);
  while (d <= end) {
    const wd = d.getDay(); // 0 Sun … 6 Sat
    if (wd !== 0 && wd !== 6) days++;
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** First and last calendar day of the leave year containing `ref` (calendar year). */
export function leaveYearRange(ref: Date = new Date()): {
  from: string;
  to: string;
  year: number;
} {
  const year = ref.getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31`, year };
}

export function daysLabel(n: number): string {
  return `${n % 1 === 0 ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;
}
