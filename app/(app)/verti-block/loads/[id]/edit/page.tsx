import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { LoadForm } from "../../load-form";
import { updateLoad } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditLoadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { roles } = await requireUser();
  if (!hasRole(roles, "plant_operator") && !isManager(roles)) {
    redirect("/dashboard");
  }
  const { id } = await params;
  const supabase = await createClient();

  const { data: load } = await supabase
    .from("verti_loads")
    .select("id, reference, customer, load_date, truck_reg, max_payload_kg, notes")
    .eq("id", id)
    .maybeSingle();
  if (!load) notFound();

  return (
    <>
      <Link className="link-back" href={`/verti-block/loads/${id}`}>
        ← Back
      </Link>
      <div className="page-head">
        <h1>Edit load details</h1>
      </div>
      <div className="card">
        <LoadForm
          action={updateLoad.bind(null, id)}
          defaults={load}
          submitLabel="Save"
        />
      </div>
    </>
  );
}
