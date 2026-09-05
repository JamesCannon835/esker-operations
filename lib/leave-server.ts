import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { DEFAULT_ANNUAL_DAYS, leaveYearRange } from "@/lib/leave";

/** Company-wide default annual entitlement (admin sets it on the Settings page). */
export async function getLeaveDefaultDays(): Promise<number> {
  const v = await getSetting("leave_default_days");
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_ANNUAL_DAYS;
}

export type LeaveBalance = {
  allowance: number;
  approved: number;
  pending: number;
  remaining: number;
  year: number;
  usingDefault: boolean;
};

/** Annual-leave balance for a person in the current leave (calendar) year. */
export async function getLeaveBalance(userId: string): Promise<LeaveBalance> {
  const supabase = await createClient();
  const { from, to, year } = leaveYearRange();

  const [{ data: allowanceRow }, { data: reqs }, def] = await Promise.all([
    supabase
      .from("leave_allowances")
      .select("annual_days")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("leave_requests")
      .select("working_days, status")
      .eq("user_id", userId)
      .eq("leave_type", "annual")
      .gte("start_date", from)
      .lte("start_date", to),
    getLeaveDefaultDays(),
  ]);

  const usingDefault = allowanceRow?.annual_days == null;
  const allowance = usingDefault ? def : Number(allowanceRow.annual_days);

  let approved = 0;
  let pending = 0;
  for (const r of reqs ?? []) {
    if (r.status === "approved") approved += Number(r.working_days);
    else if (r.status === "pending") pending += Number(r.working_days);
  }

  return {
    allowance,
    approved,
    pending,
    remaining: allowance - approved,
    year,
    usingDefault,
  };
}
