import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import { startInspection } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewVehicleInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");

  const { vehicle } = await searchParams;
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, fleet_number, registration, vehicle_type, current_mileage")
    .eq("voided", false)
    .order("registration");

  const preset = (vehicles ?? []).find((v) => v.id === vehicle);

  return (
    <>
      <Link className="link-back" href="/vehicle-inspections">
        ← Inspections
      </Link>
      <div className="page-head">
        <h1>New vehicle inspection</h1>
      </div>
      <div className="card">
        <form action={startInspection}>
          <div className="field">
            <label htmlFor="vehicle_id">
              Vehicle <span className="req">*</span>
            </label>
            <select
              id="vehicle_id"
              name="vehicle_id"
              required
              defaultValue={preset?.id ?? ""}
            >
              <option value="">— Choose vehicle —</option>
              {(vehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleName(v.fleet_number, v.registration)}
                  {v.vehicle_type ? ` · ${v.vehicle_type}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="odometer">Odometer reading (km)</label>
            <input
              id="odometer"
              name="odometer"
              type="number"
              inputMode="numeric"
              defaultValue={preset?.current_mileage ?? ""}
            />
          </div>
          <div className="btn-row">
            <button className="btn" type="submit">
              Start inspection
            </button>
            <Link className="btn ghost" href="/vehicle-inspections">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
