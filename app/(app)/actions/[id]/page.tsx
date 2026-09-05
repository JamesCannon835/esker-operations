import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  ACTION_OPEN,
  type ActionPriority,
  type ActionStatus,
} from "@/lib/maintenance";
import { canSeeAllTasks, type TaskAttachment } from "@/lib/tasks";
import { ConfirmButton } from "@/components/confirm-button";
import {
  completeAction,
  reopenAction,
  updateAction,
  registerTaskAttachment,
  deleteTaskAttachment,
  deleteTask,
} from "../actions";
import { ActionEdit, CompleteWithNote } from "../action-forms";
import { TaskPhotos } from "../task-photos";

export const dynamic = "force-dynamic";

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, roles } = await requireUser();
  const supabase = await createClient();

  const { data: a } = await supabase
    .from("actions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound();

  const workshop = canSeeAllTasks(roles);
  const mine = a.assigned_to === user.id || a.raised_by === user.id;
  if (!workshop && !mine) redirect("/dashboard");

  const [{ data: people }, { data: atts }, raiser, assignee, completer] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("action_attachments")
        .select("id, file_path, file_name, content_type, uploaded_at")
        .eq("action_id", id)
        .order("uploaded_at"),
      a.raised_by
        ? supabase
            .from("users")
            .select("full_name")
            .eq("id", a.raised_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      a.assigned_to
        ? supabase
            .from("users")
            .select("full_name")
            .eq("id", a.assigned_to)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      a.completed_by
        ? supabase
            .from("users")
            .select("full_name")
            .eq("id", a.completed_by)
            .maybeSingle()
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
  const photos = (atts ?? []) as TaskAttachment[];
  const isTask = a.entity_type === "task";

  return (
    <>
      <Link className="link-back" href="/actions">
        ← Tasks
      </Link>
      <div className="page-head">
        <h1>{a.title}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="badge">
            {ACTION_PRIORITY_LABELS[a.priority as ActionPriority] ?? a.priority}
          </span>
          {isManager(roles) && isTask && (
            <ConfirmButton
              action={deleteTask.bind(null, id)}
              label="Delete"
              className="btn ghost small"
              confirmText="Delete this task?"
            />
          )}
        </div>
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
            <div className="label">Given to</div>
            <div className="value">
              {(assignee as { full_name?: string } | null)?.full_name ??
                "Nobody yet"}
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

      <div className="card">
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2>Photos</h2>
          <TaskPhotos
            actionId={id}
            register={registerTaskAttachment.bind(null, id)}
          />
        </div>
        {photos.length === 0 ? (
          <p className="empty">No photos.</p>
        ) : (
          <div className="task-photos">
            {photos.map((p) => (
              <div className="task-photo" key={p.id}>
                <a
                  href={`/actions/attachment/${p.id}`}
                  target="_blank"
                  rel="noopener"
                >
                  <img src={`/actions/attachment/${p.id}`} alt={p.file_name ?? ""} />
                </a>
                <ConfirmButton
                  action={deleteTaskAttachment.bind(null, p.id, id)}
                  label="✕"
                  className="task-photo-del"
                  confirmText="Remove this photo?"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {open ? (
        <>
          {workshop && (
            <div className="card">
              <h2>Change details</h2>
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
          )}
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
              : "This task is cancelled."}
          </p>
          {a.completion_note && (
            <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
              {a.completion_note}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <ConfirmButton
              action={reopenAction.bind(null, id)}
              label="Reopen"
              className="btn ghost small"
            />
          </div>
        </div>
      )}
    </>
  );
}
