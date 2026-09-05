import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { SignaturePad } from "../signature-pad";
import { sendTalk, deleteTalk, signTalk, clearSignature } from "../actions";

export const dynamic = "force-dynamic";

export default async function TalkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id } = await params;
  const { e } = await searchParams;
  const { user, roles } = await requireUser();
  const supabase = await createClient();
  const manager = isManager(roles);

  const { data: talk } = await supabase
    .from("toolbox_talks")
    .select(
      "id, title, talk_date, body, document_id, status, sent_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!talk) notFound();

  const { data: recipients } = await supabase
    .from("toolbox_talk_recipients")
    .select("id, user_id, signed_at, signature_data")
    .eq("talk_id", id);

  const mine = (recipients ?? []).find((r) => r.user_id === user.id) ?? null;
  if (!manager && (!mine || talk.status !== "sent")) redirect("/toolbox");

  const { data: people } = manager
    ? await supabase.from("users").select("id, full_name")
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const total = recipients?.length ?? 0;
  const signed = (recipients ?? []).filter((r) => r.signed_at).length;

  return (
    <>
      <Link className="link-back" href="/toolbox">
        ← Toolbox talks
      </Link>
      <div className="page-head">
        <h1>{talk.title}</h1>
        {manager && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {talk.status === "draft" && (
              <>
                <Link className="btn small ghost" href={`/toolbox/${id}/edit`}>
                  Edit
                </Link>
                <ConfirmButton
                  action={sendTalk.bind(null, id)}
                  label="Send to everyone"
                  className="btn small"
                  confirmText={`Send "${talk.title}" to ${total} ${
                    total === 1 ? "person" : "people"
                  }? They'll be asked to read and sign it.`}
                />
              </>
            )}
            {talk.status === "sent" && (
              <a className="btn small" href={`/toolbox/${id}/signoff`}>
                Sign-off PDF
              </a>
            )}
            <ConfirmButton
              action={deleteTalk.bind(null, id)}
              label="Delete"
              className="btn small ghost"
              confirmText="Delete this toolbox talk and all its signatures?"
            />
          </div>
        )}
      </div>

      <p className="hint">
        {fmtDate(talk.talk_date)}
        {talk.status === "sent" && talk.sent_at
          ? ` · sent ${fmtDate(talk.sent_at)} · ${signed}/${total} signed`
          : " · draft"}
      </p>

      <div className="card">
        {talk.document_id && (
          <p>
            <a
              href={`/toolbox/${id}/document`}
              target="_blank"
              rel="noopener"
              className="btn small ghost"
            >
              📄 Open attached document
            </a>
          </p>
        )}
        {talk.body ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{talk.body}</div>
        ) : (
          !talk.document_id && <p className="empty">No content.</p>
        )}
      </div>

      {/* Staff: sign it */}
      {!manager && mine && (
        <div className="card">
          {mine.signed_at ? (
            <>
              <h2>Signed</h2>
              <p className="hint">
                You signed this on {fmtDateTime(mine.signed_at)}.
              </p>
              {mine.signature_data && (
                <img
                  src={mine.signature_data}
                  alt="Your signature"
                  className="tb-sig-img"
                />
              )}
            </>
          ) : (
            <>
              <h2>Read &amp; sign</h2>
              {e === "sig" && (
                <div className="error">
                  That signature didn&apos;t come through — please try again.
                </div>
              )}
              <SignaturePad action={signTalk.bind(null, id)} />
            </>
          )}
        </div>
      )}

      {/* Manager: who has signed */}
      {manager && (
        <div className="card">
          <h2>
            Signatures — {signed}/{total}
          </h2>
          <table className="list-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Signed</th>
                <th>Signature</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(recipients ?? [])
                .slice()
                .sort((a, b) =>
                  (nameOf.get(a.user_id) ?? "").localeCompare(
                    nameOf.get(b.user_id) ?? "",
                  ),
                )
                .map((r) => (
                  <tr key={r.id}>
                    <td>{nameOf.get(r.user_id) ?? "—"}</td>
                    <td className="muted">
                      {r.signed_at ? fmtDateTime(r.signed_at) : "—"}
                    </td>
                    <td>
                      {r.signature_data ? (
                        <img
                          src={r.signature_data}
                          alt=""
                          className="tb-sig-thumb"
                        />
                      ) : (
                        <span className="blocked">Not signed</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.signed_at && (
                        <ConfirmButton
                          action={clearSignature.bind(null, r.id, id)}
                          label="Clear"
                          className="btn ghost small"
                          confirmText={`Clear ${
                            nameOf.get(r.user_id) ?? "this"
                          } signature so they can sign again?`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
