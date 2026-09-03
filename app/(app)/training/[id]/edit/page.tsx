import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TrainingForm } from "../../training-form";
import { updateTrainingRecord } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const { data: record } = await supabase
    .from("training_records")
    .select(
      "id, user_id, course_name, completed_date, expiry_date, certificate_name, notes",
    )
    .eq("id", id)
    .maybeSingle();

  if (!record) notFound();

  const [{ data: courses }, { data: person }] = await Promise.all([
    supabase
      .from("training_courses")
      .select("id, name, active")
      .order("name"),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("id", record.user_id)
      .maybeSingle(),
  ]);

  return (
    <>
      <Link className="link-back" href={`/training/person/${record.user_id}`}>
        ← {person?.full_name ?? "Person"}
      </Link>
      <div className="page-head">
        <h1>Edit training</h1>
      </div>
      <div className="card">
        <TrainingForm
          action={updateTrainingRecord.bind(null, id)}
          courses={(courses ?? []).filter(
            (c) => c.active || c.name === record.course_name,
          )}
          people={person ? [person] : []}
          lockedPerson={person ?? undefined}
          defaults={{
            course_name: record.course_name,
            completed_date: record.completed_date,
            expiry_date: record.expiry_date,
            notes: record.notes,
            certificate_name: record.certificate_name,
          }}
          submitLabel="Save changes"
          cancelHref={`/training/person/${record.user_id}`}
        />
      </div>
    </>
  );
}
