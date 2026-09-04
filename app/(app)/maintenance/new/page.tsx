import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import { startReport } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMaintenanceReportPage() {
  const { roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, fleet_number, registration, vehicle_type")
    .eq("voided", false)
    .order("registration");

  return (
    <>
      <Link className="link-back" href="/maintenance">
        ← Maintenance reports
      </Link>
      <div className="page-head">
        <h1>New maintenance report</h1>
      </div>
      <div className="card">
        <form action={startReport}>
          <div className="field">
            <label htmlFor="vehicle_id">
              Vehicle <span className="req">*</span>
            </label>
            <select id="vehicle_id" name="vehicle_id" required defaultValue="">
              <option value="">— Choose vehicle —</option>
              {(vehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleName(v.fleet_number, v.registration)}
                  {v.vehicle_type ? ` · ${v.vehicle_type}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="btn-row">
            <button className="btn" type="submit">
              Start report
            </button>
            <Link className="btn ghost" href="/maintenance">
              Cancel
            </Link>
          </div>
        </form>
        <p className="field-hint" style={{ marginTop: 10 }}>
          Working from a driver-reported fault? Open the fault and use “Create
          maintenance report” there — the vehicle and fault details fill in
          automatically.
        </p>
      </div>
    </>
  );
}
