import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { trainingStatus } from "@/lib/training";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/compliance";
import { ConfirmButton } from "@/components/confirm-button";
import { voidTrainingRecord } from "../../actions";

export const dynamic = "force-dynamic";

function statusStyle(status: "red" | "amber" | "green") {
  if (status === "red") return { color: "var(--danger)", fontWeight: 600 };
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

  const [{ data: person }, { data: records }] = await Promise.all([
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
  ]);

  if (!person) notFound();

  const rows = records ?? [];

  return (
    <>
      <Link className="link-back" href="/training">
        ← Training register
      </Link>
      <div className="page-head">
        <h1>{person.full_name}</h1>
        <Link
          className="btn small"
          href={`/training/new?user=${person.id}`}
        >
          + Add training
        </Link>
      </div>

      {!person.active && (
        <div className="voided-banner">This person is inactive.</div>
      )}

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
                    <td style={statusStyle(s)}>
                      {r.expiry_date
                        ? COMPLIANCE_STATUS_LABELS[s]
                        : "Valid"}
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
