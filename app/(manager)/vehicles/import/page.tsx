import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ImportVehiclesForm } from "./import-vehicles-form";

export const dynamic = "force-dynamic";

export default async function ImportVehiclesPage() {
  await requireStaff();
  return (
    <>
      <Link className="link-back" href="/vehicles">
        ← Vehicles
      </Link>
      <div className="page-head">
        <h1>Import vehicles</h1>
      </div>
      <div className="card">
        <p className="hint">
          Adds vehicles and their compliance due dates in one go. Registrations
          that already exist are skipped. You set make / model / category
          afterwards.
        </p>
        <ImportVehiclesForm />
      </div>
    </>
  );
}
