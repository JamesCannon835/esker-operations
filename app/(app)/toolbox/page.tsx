import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ToolboxPage() {
  const { user, roles } = await requireUser();
  const supabase = await createClient();
  const manager = isManager(roles);

  if (manager) {
    const [{ data: talks }, { data: recips }] = await Promise.all([
      supabase
        .from("toolbox_talks")
        .select("id, title, talk_date, status, sent_at")
        .order("talk_date", { ascending: false }),
      supabase
        .from("toolbox_talk_recipients")
        .select("talk_id, signed_at"),
    ]);

    const stat = new Map<string, { total: number; signed: number }>();
    for (const r of recips ?? []) {
      const s = stat.get(r.talk_id) ?? { total: 0, signed: 0 };
      s.total++;
      if (r.signed_at) s.signed++;
      stat.set(r.talk_id, s);
    }

    return (
      <>
        <div className="page-head">
          <h1>Toolbox talks</h1>
          <Link className="btn small" href="/toolbox/new">
            + New talk
          </Link>
        </div>
        <div className="card">
          {!talks || talks.length === 0 ? (
            <p className="empty">
              No talks yet. <Link href="/toolbox/new">Create the first one</Link>.
            </p>
          ) : (
            <table className="list-table">
              <thead>
                <tr>
                  <th>Talk</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Signed</th>
                </tr>
              </thead>
              <tbody>
                {talks.map((t) => {
                  const s = stat.get(t.id) ?? { total: 0, signed: 0 };
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/toolbox/${t.id}`}>{t.title}</Link>
                      </td>
                      <td className="muted">{fmtDate(t.talk_date)}</td>
                      <td className="muted">
                        {t.status === "sent" ? "Sent" : "Draft"}
                      </td>
                      <td
                        className={
                          s.total > 0 && s.signed === s.total ? "" : "muted"
                        }
                      >
                        {s.signed}/{s.total}
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

  // Staff view — only talks sent to me.
  const { data: mine } = await supabase
    .from("toolbox_talk_recipients")
    .select("signed_at, talk:toolbox_talks(id, title, talk_date, status)")
    .eq("user_id", user.id);

  type Talk = {
    id: string;
    title: string;
    talk_date: string;
    status: string;
  };
  const rows = ((mine ?? []) as { signed_at: string | null; talk: unknown }[])
    .map((r) => ({
      signed_at: r.signed_at,
      talk: (Array.isArray(r.talk) ? r.talk[0] : r.talk) as Talk | null,
    }))
    .filter((r) => r.talk && r.talk.status === "sent")
    .sort((a, b) => (a.talk!.talk_date < b.talk!.talk_date ? 1 : -1));
  const todo = rows.filter((r) => !r.signed_at);
  const done = rows.filter((r) => r.signed_at);

  return (
    <>
      <div className="page-head">
        <h1>Toolbox talks</h1>
      </div>

      <div className="card">
        <h2>To read &amp; sign</h2>
        {todo.length === 0 ? (
          <p className="empty">You&apos;re all caught up.</p>
        ) : (
          <table className="list-table">
            <tbody>
              {todo.map((r) => (
                <tr key={r.talk!.id}>
                  <td>
                    <Link href={`/toolbox/${r.talk!.id}`}>{r.talk!.title}</Link>
                  </td>
                  <td className="muted">{fmtDate(r.talk!.talk_date)}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/toolbox/${r.talk!.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {done.length > 0 && (
        <div className="card">
          <h2>Signed</h2>
          <table className="list-table">
            <tbody>
              {done.map((r) => (
                <tr key={r.talk!.id}>
                  <td>
                    <Link href={`/toolbox/${r.talk!.id}`}>{r.talk!.title}</Link>
                  </td>
                  <td className="muted">{fmtDate(r.talk!.talk_date)}</td>
                  <td className="muted">Signed {fmtDate(r.signed_at!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
