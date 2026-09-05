import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { smsConfigured } from "@/lib/sms";
import { emailConfigured } from "@/lib/notify";

export const dynamic = "force-dynamic";

export default async function BlastingPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: notifs }, { data: recips }, { count: neighbourCount }] =
    await Promise.all([
      supabase
        .from("blast_notifications")
        .select("id, title, blast_at, status, sent_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("blast_notification_recipients")
        .select("notification_id, status, email_status"),
      supabase
        .from("neighbours")
        .select("*", { count: "exact", head: true })
        .eq("active", true),
    ]);

  const stat = new Map<string, { total: number; ok: number; failed: number }>();
  for (const r of recips ?? []) {
    const s = stat.get(r.notification_id) ?? { total: 0, ok: 0, failed: 0 };
    s.total++;
    const reached =
      ["sent", "delivered"].includes(r.status) ||
      ["sent", "delivered"].includes(r.email_status);
    const failed = r.status === "failed" || r.email_status === "failed";
    if (reached) s.ok++;
    if (failed && !reached) s.failed++;
    stat.set(r.notification_id, s);
  }

  return (
    <>
      <div className="page-head">
        <h1>Blast notifications</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn small" href="/blasting/new">
            + New notification
          </Link>
          <Link className="btn small ghost" href="/blasting/neighbours">
            Neighbours ({neighbourCount ?? 0})
          </Link>
          <Link className="btn small ghost" href="/blasting/templates">
            Templates
          </Link>
        </div>
      </div>

      {!smsConfigured() && !emailConfigured() && (
        <div className="error">
          No texting service or email is connected yet, so notifications can be
          drafted and logged but not actually sent. Connect a texting service
          (e.g. Twilio) and/or email to finish this off.
        </div>
      )}
      {(smsConfigured() || emailConfigured()) &&
        !(smsConfigured() && emailConfigured()) && (
          <p className="hint">
            {smsConfigured()
              ? "Texting is connected; email is not — neighbours with only an email won't be reached."
              : "Email is connected; texting is not — neighbours with only a mobile won't be reached."}
          </p>
        )}

      <div className="card">
        {!notifs || notifs.length === 0 ? (
          <p className="empty">
            Nothing yet. <Link href="/blasting/new">Draft the first one</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Blast</th>
                <th>Status</th>
                <th>Texts</th>
              </tr>
            </thead>
            <tbody>
              {notifs.map((n) => {
                const s = stat.get(n.id) ?? { total: 0, ok: 0, failed: 0 };
                return (
                  <tr key={n.id}>
                    <td>
                      <Link href={`/blasting/${n.id}`}>
                        {n.title || "Blast notification"}
                      </Link>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {n.blast_at
                          ? fmtDateTime(n.blast_at)
                          : `drafted ${fmtDate(n.created_at)}`}
                      </div>
                    </td>
                    <td className="muted">
                      {n.status === "sent"
                        ? `Sent ${n.sent_at ? fmtDate(n.sent_at) : ""}`
                        : "Draft"}
                    </td>
                    <td className="muted">
                      {s.ok}/{s.total}
                      {s.failed > 0 && (
                        <span className="blocked" style={{ marginLeft: 6 }}>
                          {s.failed} failed
                        </span>
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
