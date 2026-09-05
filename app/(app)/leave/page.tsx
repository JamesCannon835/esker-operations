import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import {
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveRequest,
} from "@/lib/leave";
import { getLeaveBalance } from "@/lib/leave-server";
import { ConfirmButton } from "@/components/confirm-button";
import { LeaveForm } from "./leave-form";
import { requestLeave, cancelLeave } from "./actions";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const { user, roles } = await requireUser();
  const supabase = await createClient();
  const manager = isManager(roles);

  const [balance, { data: requests }, { count: pendingCount }] =
    await Promise.all([
      getLeaveBalance(user.id),
      supabase
        .from("leave_requests")
        .select(
          "id, leave_type, start_date, end_date, working_days, reason, status, decision_note",
        )
        .eq("user_id", user.id)
        .order("start_date", { ascending: false }),
      manager
        ? supabase
            .from("leave_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
    ]);

  const rows = (requests ?? []) as Pick<
    LeaveRequest,
    | "id"
    | "leave_type"
    | "start_date"
    | "end_date"
    | "working_days"
    | "reason"
    | "status"
    | "decision_note"
  >[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <h1>Time off</h1>
        {manager && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn small" href="/leave/approvals">
              Approvals
              {pendingCount ? ` (${pendingCount})` : ""}
            </Link>
            <Link className="btn small ghost" href="/leave/calendar">
              Team calendar
            </Link>
            <Link className="btn small ghost" href="/leave/allowances">
              Allowances
            </Link>
          </div>
        )}
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="tile">
          <div className="label">Days left {balance.year}</div>
          <div className="value">{balance.remaining}</div>
        </div>
        <div className="tile">
          <div className="label">Allowance</div>
          <div className="value">{balance.allowance}</div>
        </div>
        <div className="tile">
          <div className="label">Booked / taken</div>
          <div className="value">{balance.approved}</div>
        </div>
        <div className="tile">
          <div className="label">Awaiting approval</div>
          <div className="value" style={{ color: "var(--amber)" }}>
            {balance.pending}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Book time off</h2>
        <p className="hint">
          Annual leave goes to management for approval. You&apos;ll see it here as
          &ldquo;awaiting approval&rdquo; until it&apos;s signed off.
        </p>
        <LeaveForm action={requestLeave} submitLabel="Send request" />
      </div>

      <div className="card">
        <h2>Your requests</h2>
        {rows.length === 0 ? (
          <p className="empty">Nothing booked yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Dates</th>
                <th>Type</th>
                <th>Days</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const canCancel =
                  (r.status === "pending" || r.status === "approved") &&
                  r.end_date >= today;
                return (
                  <tr key={r.id}>
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
                      {r.decision_note && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          Manager: {r.decision_note}
                        </div>
                      )}
                    </td>
                    <td className="muted">{LEAVE_TYPE_LABELS[r.leave_type]}</td>
                    <td className="muted">{r.working_days}</td>
                    <td>
                      {r.status === "pending" ? (
                        <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                          {LEAVE_STATUS_LABELS[r.status]}
                        </span>
                      ) : r.status === "rejected" ? (
                        <span className="blocked">
                          {LEAVE_STATUS_LABELS[r.status]}
                        </span>
                      ) : (
                        <span className="muted">
                          {LEAVE_STATUS_LABELS[r.status]}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canCancel && (
                        <ConfirmButton
                          action={cancelLeave.bind(null, r.id)}
                          label="Cancel"
                          className="btn ghost small"
                          confirmText="Cancel this time-off request?"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
