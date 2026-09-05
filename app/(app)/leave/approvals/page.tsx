import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { LEAVE_TYPE_LABELS } from "@/lib/leave";
import { getLeaveBalance } from "@/lib/leave-server";
import { LeaveForm } from "../leave-form";
import { DecideButtons } from "../decide-buttons";
import { bookForSomeone } from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string;
  leave_type: "annual" | "sick";
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string | null;
};

export default async function LeaveApprovalsPage() {
  await requireManager();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: people }, { data: pending }, { data: upcoming }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("leave_requests")
        .select(
          "id, user_id, leave_type, start_date, end_date, working_days, reason",
        )
        .eq("status", "pending")
        .order("start_date"),
      supabase
        .from("leave_requests")
        .select("id, user_id, leave_type, start_date, end_date, working_days")
        .eq("status", "approved")
        .gte("end_date", today)
        .order("start_date"),
    ]);

  const nameOf = new Map(
    (people ?? []).map((p) => [p.id, p.full_name as string]),
  );
  const pendingRows = (pending ?? []) as Row[];

  // Remaining-days context for each person with a pending request.
  const balances = new Map<string, number>();
  await Promise.all(
    [...new Set(pendingRows.map((r) => r.user_id))].map(async (uid) => {
      const b = await getLeaveBalance(uid);
      balances.set(uid, b.remaining);
    }),
  );

  return (
    <>
      <Link className="link-back" href="/leave">
        ← Time off
      </Link>
      <div className="page-head">
        <h1>Leave approvals</h1>
        <Link className="btn small ghost" href="/leave/calendar">
          Company calendar
        </Link>
      </div>

      <div className="card">
        <h2>Awaiting approval</h2>
        {pendingRows.length === 0 ? (
          <p className="empty">Nothing waiting.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Dates</th>
                <th>Type</th>
                <th>Days</th>
                <th>Left</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((r) => (
                <tr key={r.id}>
                  <td>{nameOf.get(r.user_id) ?? "—"}</td>
                  <td>
                    {fmtDate(r.start_date)}
                    {r.end_date !== r.start_date
                      ? ` – ${fmtDate(r.end_date)}`
                      : ""}
                    {r.reason && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.reason}
                      </div>
                    )}
                  </td>
                  <td className="muted">{LEAVE_TYPE_LABELS[r.leave_type]}</td>
                  <td className="muted">{r.working_days}</td>
                  <td className="muted">
                    {r.leave_type === "annual"
                      ? (balances.get(r.user_id) ?? "—")
                      : "—"}
                  </td>
                  <td>
                    <DecideButtons id={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Book time off for someone</h2>
        <p className="hint">Recorded as approved straight away.</p>
        <LeaveForm
          action={bookForSomeone}
          people={(people ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
          }))}
          submitLabel="Record time off"
        />
      </div>

      <div className="card">
        <h2>Approved &amp; upcoming</h2>
        {!upcoming || upcoming.length === 0 ? (
          <p className="empty">Nothing booked ahead.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Dates</th>
                <th>Type</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((r) => (
                <tr key={r.id}>
                  <td>{nameOf.get(r.user_id) ?? "—"}</td>
                  <td>
                    {fmtDate(r.start_date)}
                    {r.end_date !== r.start_date
                      ? ` – ${fmtDate(r.end_date)}`
                      : ""}
                  </td>
                  <td className="muted">
                    {LEAVE_TYPE_LABELS[r.leave_type as "annual" | "sick"]}
                  </td>
                  <td className="muted">{r.working_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
