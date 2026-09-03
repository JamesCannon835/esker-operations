import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TrainingForm } from "../training-form";
import { addTrainingRecord } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  await requireManager();
  const { user } = await searchParams;
  const supabase = await createClient();

  const [{ data: courses }, { data: people }] = await Promise.all([
    supabase
      .from("training_courses")
      .select("id, name, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("users")
      .select("id, full_name, active")
      .eq("active", true)
      .order("full_name"),
  ]);

  const locked = user
    ? (people ?? []).find((p) => p.id === user)
    : undefined;

  return (
    <>
      <Link
        className="link-back"
        href={locked ? `/training/person/${locked.id}` : "/training"}
      >
        ← {locked ? locked.full_name : "Training register"}
      </Link>
      <div className="page-head">
        <h1>Add training</h1>
      </div>
      <div className="card">
        <TrainingForm
          action={addTrainingRecord}
          courses={courses ?? []}
          people={people ?? []}
          lockedPerson={locked}
          submitLabel="Add training"
          cancelHref={
            locked ? `/training/person/${locked.id}` : "/training"
          }
        />
      </div>
    </>
  );
}
