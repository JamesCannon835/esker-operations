import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  ACTION_OPEN,
  type ActionPriority,
  type ActionStatus,
} from "@/lib/maintenance";
import { ConfirmButton } from "@/components/confirm-button";
import { completeAction, reopenAction, updateAction } from "../actions";
import { ActionEdit, CompleteWithNote } from "../action-forms";

export const dynamic = "force-dynamic";

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: a } = await supabase
    .from("actions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound();

  const [{ data: people }, raiser, assignee, completer] = await Promise.all([
    supabase.from("users").select("id, full_name").eq("active", true).order("full_name"),
    a.raised_by
      ? supabase.from("users").select("full_name").eq("id", a.raised_by).maybeSingle()
      : Promise.resolve({ data: null }),
    a.assigned_to
      ? supabase.from("users").select("full_name").eq("id", a.assigned_to).maybeSingle()
      : Promise.resolve({ data: null }),
    a.completed_by
      ? supabase.from("users").select("full_name").eq("id", a.completed_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let sourceLink: { href: string; label: string } | null = null;
  if (a.entity_type === "maintenance_report") {
    const { data: rep } = await supabase
      .from("maintenance_reports")
      .select("report_number")
      .eq("id", a.entity_id)
      .maybeSingle();
    sourceLink = {
      href: `/maintenance/${a.entity_id}`,
      label: rep?.report_number ?? "Maintenance report",
    };
  }

  const open = ACTION_OPEN.includes(a.status as ActionStatus);

  return (
    <>
      <Link className="link-back" href="/actions">
        ← Actions
      </Link>
      <div className="page-head">
        <h1>{a.title}</h1>
        <span className={open && (a.priority === "critical" || a.priority === "high") ? "severity-pill critical" : "badge"}>
          {ACTION_PRIORITY_LABELS[a.priority as ActionPriority] ?? a.priority}
        </span>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div>
            <div className="label">Status</div>
            <div className="value">
              {ACTION_STATUS_LABELS[a.status as ActionStatus] ?? a.status}
            </div>
          </div>
          <div>
            <div className="label">Owner</div>
            <div className="value">
              {(assignee as { full_name?: string } | null)?.full_name ??
                "Unassigned"}
            </div>
          </div>
          <div>
            <div className="label">Due</div>
            <div className="value">{a.due_date ? fmtDate(a.due_date) : "—"}</div>
          </div>
          <div>
            <div className="label">Raised</div>
            <div className="value">
              {fmtDate(a.created_at)} ·{" "}
              {(raiser as { full_name?: string } | null)?.full_name ?? "—"}
            </div>
          </div>
          {sourceLink && (
            <div>
              <div className="label">From</div>
              <div className="value">
                <Link href={sourceLink.href}>{sourceLink.label}</Link>
              </div>
            </div>
          )}
        </div>
        {a.detail && (
          <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{a.detail}</p>
        )}
      </div>

      {open ? (
        <>
          <div className="card">
            <h2>Update</h2>
            <ActionEdit
              action={updateAction.bind(null, id)}
              people={people ?? []}
              current={{
                priority: a.priority,
                assigned_to: a.assigned_to,
                due_date: a.due_date,
                detail: a.detail,
              }}
            />
          </div>
          <div className="card">
            <h2>Mark done</h2>
            <CompleteWithNote action={completeAction.bind(null, id)} />
          </div>
        </>
      ) : (
        <div className="card">
          <p className="hint" style={{ margin: 0 }}>
            {a.status === "done"
              ? `Done ${a.completed_at ? fmtDateTime(a.completed_at) : ""} by ${
                  (completer as { full_name?: string } | null)?.full_name ??
                  "someone"
                }.`
              : "This action is cancelled."}
          </p>
          {a.completion_note && (
            <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
              {a.completion_note}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <ConfirmButton
              action={reopenAction.bind(null, id)}
              label="Reopen action"
              className="btn ghost small"
            />
          </div>
        </div>
      )}
    </>
  );
}
