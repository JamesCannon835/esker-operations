import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVehiclesForAssignment } from "@/lib/assets-server";
import { updateTrailer } from "../../actions";
import { TrailerForm } from "../../trailer-form";

export const dynamic = "force-dynamic";

export default async function EditTrailerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: trailer }, vehicles, { data: compliance }] = await Promise.all([
    supabase.from("trailers").select("*").eq("id", id).maybeSingle(),
    getVehiclesForAssignment(),
    supabase
      .from("compliance_items")
      .select("id, compliance_type, due_date")
      .eq("asset_type", "trailer")
      .eq("asset_id", id)
      .eq("voided", false),
  ]);

  if (!trailer) notFound();

  return (
    <>
      <Link className="link-back" href={`/trailers/${id}`}>
        ← {trailer.registration}
      </Link>
      <div className="page-head">
        <h1>Edit {trailer.registration}</h1>
      </div>
      <div className="card">
        <TrailerForm
          action={updateTrailer.bind(null, id)}
          vehicles={vehicles}
          defaults={trailer}
          compliance={compliance ?? []}
          submitLabel="Save changes"
          cancelHref={`/trailers/${id}`}
        />
      </div>
    </>
  );
}
