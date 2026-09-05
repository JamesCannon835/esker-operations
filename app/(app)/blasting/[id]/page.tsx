import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { RECIPIENT_STATUS_LABELS } from "@/lib/blasting";
import { smsConfigured } from "@/lib/sms";
import { emailConfigured } from "@/lib/notify";
import { ConfirmButton } from "@/components/confirm-button";
import {
  sendNotification,
  deleteNotification,
  resendFailed,
} from "../actions";

export const dynamic = "force-dynamic";

function ChannelStatus({
  contact,
  status,
  error,
}: {
  contact: string | null;
  status: string;
  error: string | null;
}) {
  if (!contact) return <span className="muted">—</span>;
  if (status === "failed")
    return (
      <span className="blocked" title={error ?? ""}>
        Failed
      </span>
    );
  return (
    <span className="muted">
      {RECIPIENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default async function NotificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const { e } = await searchParams;
  const supabase = await createClient();

  const { data: n } = await supabase
    .from("blast_notifications")
    .select("id, title, blast_at, message, status, sent_at")
    .eq("id", id)
    .maybeSingle();
  if (!n) notFound();

  const { data: recips } = await supabase
    .from("blast_notification_recipients")
    .select("id, name, phone, email, status, error, email_status, email_error")
    .eq("notification_id", id)
    .order("name");

  const rows = recips ?? [];
  const failed = rows.filter(
    (r) => r.status === "failed" || r.email_status === "failed",
  ).length;
  const draft = n.status === "draft";
  const noChannel = !smsConfigured() && !emailConfigured();

  return (
    <>
      <Link className="link-back" href="/blasting">
        ← Blast notifications
      </Link>
      <div className="page-head">
        <h1>{n.title || "Blast notification"}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {draft && (
            <>
              <Link className="btn small ghost" href={`/blasting/${id}/edit`}>
                Edit
              </Link>
              <ConfirmButton
                action={sendNotification.bind(null, id)}
                label={`Send to ${rows.length}`}
                className="btn small"
                confirmText={`Send this text to ${rows.length} ${
                  rows.length === 1 ? "neighbour" : "neighbours"
                }?`}
              />
            </>
          )}
          {!draft && failed > 0 && (
            <ConfirmButton
              action={resendFailed.bind(null, id)}
              label={`Retry ${failed} failed`}
              className="btn small"
              confirmText={`Retry sending to the ${failed} that failed?`}
            />
          )}
          <ConfirmButton
            action={deleteNotification.bind(null, id)}
            label="Delete"
            className="btn small ghost"
            confirmText="Delete this notification and its log?"
          />
        </div>
      </div>

      {e === "nochannel" && (
        <div className="error">
          Can&apos;t send yet — neither a texting service nor email is connected.
          The draft and recipient list are saved.
        </div>
      )}

      <p className="hint">
        {n.blast_at ? `Planned blast: ${fmtDateTime(n.blast_at)} · ` : ""}
        {draft ? "Draft" : `Sent ${n.sent_at ? fmtDateTime(n.sent_at) : ""}`}
        {noChannel && draft ? " · sending not connected" : ""}
      </p>

      <div className="card">
        <h2>Message</h2>
        <div style={{ whiteSpace: "pre-wrap" }}>{n.message}</div>
      </div>

      <div className="card">
        <h2>Neighbours ({rows.length})</h2>
        <table className="list-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Text</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  <ChannelStatus
                    contact={r.phone}
                    status={r.status}
                    error={r.error}
                  />
                </td>
                <td>
                  <ChannelStatus
                    contact={r.email}
                    status={r.email_status}
                    error={r.email_error}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
