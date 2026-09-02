import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAssignablePeople } from "@/lib/assets-server";
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

  const [{ data: vehicle }, drivers] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
    getAssignablePeople("driver"),
  ]);

  if (!vehicle) notFound();

  return (
    <>
      <Link className="link-back" href={`/vehicles/${id}`}>
        ← {vehicle.fleet_number}
      </Link>
      <div className="page-head">
        <h1>Edit {vehicle.fleet_number}</h1>
      </div>
      <div className="card">
        <VehicleForm
          action={updateVehicle.bind(null, id)}
          drivers={drivers}
          defaults={vehicle}
          submitLabel="Save changes"
          cancelHref={`/vehicles/${id}`}
        />
      </div>
    </>
  );
}
