import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "@/components/confirm-button";
import { CourseAddForm } from "./course-add-form";
import { setCourseActive } from "../actions";

export const dynamic = "force-dynamic";

export default async function TrainingCoursesPage() {
  await requireManager();
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, name, active")
    .order("name");

  const rows = courses ?? [];

  return (
    <>
      <Link className="link-back" href="/training">
        ← Training register
      </Link>
      <div className="page-head">
        <h1>Training courses</h1>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No courses yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Shown in register</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    {c.active ? (
                      <span className="ok">Yes</span>
                    ) : (
                      <span className="muted">Hidden</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <ConfirmButton
                      action={setCourseActive.bind(null, c.id, !c.active)}
                      label={c.active ? "Hide" : "Show"}
                      className="btn ghost small"
                      confirmText={
                        c.active
                          ? "Hide this course from the register? Existing records keep it."
                          : "Show this course in the register again?"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <CourseAddForm />
      </div>

      <p className="field-hint">
        Hiding a course removes its column from the register but never touches
        records already logged against it.
      </p>
    </>
  );
}
