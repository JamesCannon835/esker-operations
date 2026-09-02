import Link from "next/link";
import { getAssignablePeople } from "@/lib/assets-server";
import { createVehicle } from "../actions";
import { VehicleForm } from "../vehicle-form";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const drivers = await getAssignablePeople("driver");

  return (
    <>
      <Link className="link-back" href="/vehicles">
        ← Vehicles
      </Link>
      <div className="page-head">
        <h1>Add vehicle</h1>
      </div>
      <div className="card">
        <VehicleForm
          action={createVehicle}
          drivers={drivers}
          submitLabel="Create vehicle"
          cancelHref="/vehicles"
        />
      </div>
    </>
  );
}
