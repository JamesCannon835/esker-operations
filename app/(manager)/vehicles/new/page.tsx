import Link from "next/link";
import { createVehicle } from "../actions";
import { VehicleForm } from "../vehicle-form";

export const dynamic = "force-dynamic";

export default function NewVehiclePage() {
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
          mode="create"
          submitLabel="Add vehicle"
          cancelHref="/vehicles"
        />
        <p className="field-hint" style={{ marginTop: 12 }}>
          Assign a driver, mileage and service schedule after saving, on the
          vehicle&apos;s page.
        </p>
      </div>
    </>
  );
}
