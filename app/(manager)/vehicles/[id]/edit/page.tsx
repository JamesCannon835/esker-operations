import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import { updateVehicle } from "../../actions";
import { VehicleForm } from "../../vehicle-form";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!vehicle) notFound();
  const name = vehicleName(vehicle.fleet_number, vehicle.registration);

  return (
    <>
      <Link className="link-back" href={`/vehicles/${id}`}>
        ← {name}
      </Link>
      <div className="page-head">
        <h1>Edit {name}</h1>
      </div>
      <div className="card">
        <VehicleForm
          action={updateVehicle.bind(null, id)}
          defaults={vehicle}
          submitLabel="Save changes"
          cancelHref={`/vehicles/${id}`}
        />
      </div>
    </>
  );
}
