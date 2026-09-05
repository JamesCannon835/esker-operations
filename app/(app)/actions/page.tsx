import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  ACTION_OPEN,
  type ActionPriority,
  type ActionStatus,
} from "@/lib/maintenance";
import { canSeeTasks, canSeeAllTasks, canAssignTasks } from "@/lib/tasks";
import { ConfirmButton } from "@/components/confirm-button";
import { markActionDone } from "./actions";

export const dynamic = "force-dynamic";

const PRIO_RANK: Record<ActionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

type Row = {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
};

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { user, roles } = await requireUser();
  if (!canSeeTasks(roles)) redirect("/dashboard");
  const workshop = canSeeAllTasks(roles);

  const { show } = await searchParams;
  const filter = show ?? (workshop ? "open" : "mine");

  const supabase = await createClient();
  let q = supabase
    .from("actions")
    .select(
      "id, entity_type, entity_id, title, priority, status, due_date, assigned_to, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (!workshop) {
    q = q.eq("assigned_to", user.id);
    if (filter === "done") q = q.eq("status", "done");
    else q = q.in("status", ACTION_OPEN);
  } else if (filter === "mine")
    q = q.eq("assigned_to", user.id).in("status", ACTION_OPEN);
  else if (filter === "open") q = q.in("status", ACTION_OPEN);
  else if (filter === "done") q = q.eq("status", "done");

  const { data, error } = await q;
  let rows = (data ?? []) as Row[];

  const today = new Date().toISOString().slice(0, 10);
  if (filter === "overdue")
    rows = rows.filter(
      (r) =>
        ACTION_OPEN.includes(r.status as ActionStatus) &&
        r.due_date &&
        r.due_date < today,
    );

  rows.sort(
    (a, b) =>
      PRIO_RANK[a.priority as ActionPriority] -
        PRIO_RANK[b.priority as ActionPriority] ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );

  const userIds = [
    ...new Set(rows.map((r) => r.assigned_to).filter(Boolean)),
  ] as string[];
  const uMap = new Map<string, string>();
  if (userIds.length) {
    const { data: us } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", userIds);
    for (const u of us ?? []) uMap.set(u.id, u.full_name);
  }
  const reportIds = [
    ...new Set(
      rows
        .filter((r) => r.entity_type === "maintenance_report")
        .map((r) => r.entity_id),
    ),
  ];
  const rMap = new Map<string, string | null>();
  if (reportIds.length) {
    const { data: reps } = await supabase
      .from("maintenance_reports")
      .select("id, report_number")
      .in("id", reportIds);
    for (const rep of reps ?? []) rMap.set(rep.id, rep.report_number);
  }

  const TABS = workshop
    ? [
        { key: "open", label: "Open" },
        { key: "mine", label: "Mine" },
        { key: "overdue", label: "Overdue" },
        { key: "done", label: "Done" },
        { key: "all", label: "All" },
      ]
    : [
        { key: "mine", label: "To do" },
        { key: "done", label: "Done" },
      ];

  return (
    <>
      <div className="page-head">
        <h1>Tasks</h1>
        {canAssignTasks(roles) && (
          <Link className="btn small" href="/actions/new">
            + New task
          </Link>
        )}
      </div>

      <div className="nav-inner" style={{ padding: 0, marginBottom: 14 }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/actions?show=${t.key}`}
            className="btn ghost small"
            style={
              filter === t.key
                ? { background: "var(--brand)", color: "#fff" }
                : undefined
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">Nothing here.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Task</th>
                  {workshop && <th>From</th>}
                  {workshop && <th>Owner</th>}
                  <th>Due</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const overdue =
                    r.due_date &&
                    r.due_date < today &&
                    ACTION_OPEN.includes(r.status as ActionStatus);
                  const repNum =
                    r.entity_type === "maintenance_report"
                      ? rMap.get(r.entity_id)
                      : null;
                  return (
                    <tr key={r.id}>
                      <td>
                        <span
                          className={
                            r.priority === "critical" || r.priority === "high"
                              ? "blocked"
                              : undefined
                          }
                        >
                          {ACTION_PRIORITY_LABELS[
                            r.priority as ActionPriority
                          ] ?? r.priority}
                        </span>
                      </td>
                      <td>
                        <Link href={`/actions/${r.id}`}>{r.title}</Link>
                      </td>
                      {workshop && (
                        <td className="muted">
                          {r.entity_type === "maintenance_report" ? (
                            <Link href={`/maintenance/${r.entity_id}`}>
                              {repNum ?? "Maintenance"}
                            </Link>
                          ) : r.entity_type === "task" ? (
                            "Task"
                          ) : (
                            r.entity_type.replace("_", " ")
                          )}
                        </td>
                      )}
                      {workshop && (
                        <td className="muted">
                          {uMap.get(r.assigned_to ?? "") ?? "—"}
                        </td>
                      )}
                      <td
                        className={overdue ? "blocked" : "muted"}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {r.due_date ? fmtDate(r.due_date) : "—"}
                        {overdue ? " ⚠" : ""}
                      </td>
                      <td className="muted">
                        {ACTION_STATUS_LABELS[r.status as ActionStatus] ??
                          r.status}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {ACTION_OPEN.includes(r.status as ActionStatus) && (
                          <ConfirmButton
                            action={markActionDone.bind(null, r.id)}
                            label="Done"
                            className="btn small"
                            confirmText="Mark this task done?"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
