import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAssignTasks } from "@/lib/tasks";
import { TaskForm } from "../task-form";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const { roles } = await requireUser();
  if (!canAssignTasks(roles)) redirect("/actions");
  const supabase = await createClient();

  const { data: people } = await supabase
    .from("users")
    .select("id, full_name, active")
    .eq("active", true)
    .order("full_name");

  return (
    <>
      <Link className="link-back" href="/actions">
        ← Tasks
      </Link>
      <div className="page-head">
        <h1>New task</h1>
      </div>
      <div className="card">
        <TaskForm
          people={(people ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
          }))}
        />
      </div>
    </>
  );
}
