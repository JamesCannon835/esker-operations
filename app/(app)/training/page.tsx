import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { trainingStatus } from "@/lib/training";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/compliance";

export const dynamic = "force-dynamic";

function cellStyle(status: "red" | "amber" | "green") {
  if (status === "red") return { color: "var(--danger)", fontWeight: 600 };
  if (status === "amber") return { color: "var(--amber)", fontWeight: 600 };
  return undefined;
}

export default async function TrainingRegisterPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: people }, { data: courses }, { data: records }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("training_courses")
        .select("id, name, active")
        .eq("active", true)
        .order("name"),
      supabase
        .from("training_records")
        .select("user_id, course_name, completed_date, expiry_date")
        .eq("voided", false),
    ]);

  const courseNames = (courses ?? []).map((c) => c.name);

  // latest record per person+course
  const latest = new Map<string, { completed: string; expiry: string | null }>();
  for (const r of records ?? []) {
    const key = `${r.user_id}::${r.course_name}`;
    const prev = latest.get(key);
    if (!prev || r.completed_date > prev.completed) {
      latest.set(key, { completed: r.completed_date, expiry: r.expiry_date });
    }
  }

  let overdue = 0;
  let dueSoon = 0;
  for (const v of latest.values()) {
    if (!v.expiry) continue;
    const s = trainingStatus(v.expiry);
    if (s === "red") overdue++;
    else if (s === "amber") dueSoon++;
  }

  return (
    <>
      <div className="page-head">
        <h1>Training register</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn small ghost" href="/training/courses">
            Courses
          </Link>
          <Link className="btn small" href="/training/new">
            + Add training
          </Link>
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="tile">
          <div className="label">Expired</div>
          <div className="value" style={{ color: "var(--danger)" }}>
            {overdue}
          </div>
        </div>
        <div className="tile">
          <div className="label">Due within 14 days</div>
          <div className="value" style={{ color: "var(--amber)" }}>
            {dueSoon}
          </div>
        </div>
        <div className="tile">
          <div className="label">People</div>
          <div className="value">{people?.length ?? 0}</div>
        </div>
      </div>

      <div className="card">
        {!people || people.length === 0 ? (
          <p className="empty">No active people.</p>
        ) : courseNames.length === 0 ? (
          <p className="empty">
            No courses yet. <Link href="/training/courses">Add courses</Link>.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Person</th>
                  {courseNames.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/training/person/${p.id}`}>
                        {p.full_name}
                      </Link>
                    </td>
                    {courseNames.map((c) => {
                      const hit = latest.get(`${p.id}::${c}`);
                      if (!hit)
                        return (
                          <td key={c} className="muted">
                            —
                          </td>
                        );
                      const s = trainingStatus(hit.expiry);
                      return (
                        <td key={c} style={cellStyle(s)}>
                          {hit.expiry ? fmtDate(hit.expiry) : "✓"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="field-hint">
        Cells show the <strong>expiry date</strong> (or ✓ if the course has no
        expiry). Red = expired, amber = due within 14 days ·{" "}
        {COMPLIANCE_STATUS_LABELS.green} otherwise. Click a name for detail.
      </p>
    </>
  );
}
