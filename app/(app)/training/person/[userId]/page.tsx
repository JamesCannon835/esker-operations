import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { trainingStatus } from "@/lib/training";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/compliance";
import { ConfirmButton } from "@/components/confirm-button";
import { voidTrainingRecord, setPersonFolder } from "../../actions";

export const dynamic = "force-dynamic";

function statusStyle(status: "red" | "amber" | "green") {
  if (status === "amber") return { color: "var(--amber)", fontWeight: 600 };
  return undefined;
}

export default async function PersonTrainingPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireManager();
  const { userId } = await params;
  const supabase = await createClient();

  const [{ data: person }, { data: records }, { data: mapping }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, active")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("training_records")
        .select(
          "id, course_name, completed_date, expiry_date, certificate_name, notes, voided",
        )
        .eq("user_id", userId)
        .eq("voided", false)
        .order("completed_date", { ascending: false }),
      supabase
        .from("hs_person_folders")
        .select("folder_id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (!person) notFound();

  const rows = records ?? [];

  // Folder picker options: subfolders of the "Training Records" folder.
  const { data: trFolder } = await supabase
    .from("hs_folders")
    .select("id")
    .eq("section", "health_safety")
    .ilike("name", "%training records%")
    .order("name")
    .limit(1)
    .maybeSingle();
  const { data: folderOpts } = trFolder
    ? await supabase
        .from("hs_folders")
        .select("id, name")
        .eq("parent_id", trFolder.id)
        .order("name")
    : { data: [] as { id: string; name: string }[] };
  const linkedId: string | null = mapping?.folder_id ?? null;
  const saveFolder = setPersonFolder.bind(null, person.id);

  return (
    <>
      <Link className="link-back" href="/training">
        ← Training register
      </Link>
      <div className="page-head">
        <h1>{person.full_name}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {linkedId && (
            <Link
              className="btn small ghost"
              href={`/library/health-safety/f/${linkedId}`}
            >
              📁 Records folder
            </Link>
          )}
          <Link className="btn small" href={`/training/new?user=${person.id}`}>
            + Add training
          </Link>
        </div>
      </div>

      {!person.active && (
        <div className="voided-banner">This person is inactive.</div>
      )}

      <form action={saveFolder} className="card" style={{ marginBottom: 16 }}>
        <label htmlFor="folder_id">
          <strong>Health &amp; Safety records folder</strong>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            id="folder_id"
            name="folder_id"
            defaultValue={linkedId ?? ""}
            style={{ minWidth: 220 }}
          >
            <option value="">— not linked —</option>
            {(folderOpts ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button className="btn small" type="submit">
            Save
          </button>
        </div>
        <p className="field-hint">
          Links this person to their folder in the Health &amp; Safety library so
          you can jump straight to their certificates.
        </p>
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No training recorded yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Completed</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Certificate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = trainingStatus(r.expiry_date);
                return (
                  <tr key={r.id}>
                    <td>
                      {r.course_name}
                      {r.notes && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {r.notes}
                        </div>
                      )}
                    </td>
                    <td className="muted">{fmtDate(r.completed_date)}</td>
                    <td className="muted">
                      {r.expiry_date ? fmtDate(r.expiry_date) : "—"}
                    </td>
                    <td>
                      {r.expiry_date ? (
                        s === "red" ? (
                          <span className="blocked">
                            {COMPLIANCE_STATUS_LABELS[s]}
                          </span>
                        ) : (
                          <span style={statusStyle(s)}>
                            {COMPLIANCE_STATUS_LABELS[s]}
                          </span>
                        )
                      ) : (
                        "Valid"
                      )}
                    </td>
                    <td>
                      {r.certificate_name ? (
                        <Link href={`/training/${r.id}/certificate`}>
                          Download
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        className="btn ghost small"
                        href={`/training/${r.id}/edit`}
                      >
                        Edit
                      </Link>{" "}
                      <ConfirmButton
                        action={voidTrainingRecord.bind(null, r.id)}
                        label="Remove"
                        className="btn ghost small"
                        confirmText="Remove this training record? It won't be deleted, just hidden."
                      />
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
