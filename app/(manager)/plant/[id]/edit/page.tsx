import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePlant } from "../../actions";
import { PlantForm } from "../../plant-form";

export const dynamic = "force-dynamic";

export default async function EditPlantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: plant }, { data: compliance }] = await Promise.all([
    supabase.from("plant").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("compliance_items")
      .select("id, compliance_type, due_date")
      .eq("asset_type", "plant")
      .eq("asset_id", id)
      .eq("voided", false),
  ]);

  if (!plant) notFound();

  return (
    <>
      <Link className="link-back" href={`/plant/${id}`}>
        ← {plant.asset_number}
      </Link>
      <div className="page-head">
        <h1>Edit {plant.asset_number}</h1>
      </div>
      <div className="card">
        <PlantForm
          action={updatePlant.bind(null, id)}
          defaults={plant}
          compliance={compliance ?? []}
          submitLabel="Save changes"
          cancelHref={`/plant/${id}`}
        />
      </div>
    </>
  );
}
