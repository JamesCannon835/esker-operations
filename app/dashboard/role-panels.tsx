import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isManager, hasRole, type Role } from "@/lib/roles";

/**
 * Placeholder "home screen" per role, matching sections 7-8 of the
 * architecture document. Buttons are stubs until their phase is built.
 * The point of V1 is that each role lands on a different screen.
 */
export async function RolePanels({
  userId,
  roles,
}: {
  userId: string;
  roles: Role[];
}) {
  const supabase = await createClient();
  const panels: React.ReactNode[] = [];

  if (hasRole(roles, "driver")) {
    const { data: myVehicles } = await supabase
      .from("vehicles")
      .select("fleet_number, registration, make, model, status")
      .eq("assigned_driver_id", userId)
      .eq("voided", false)
      .order("fleet_number");

    panels.push(
      <div className="card" key="driver">
        <h2>Driver — My Vehicle</h2>
        <p className="hint">Phone-first daily workflow.</p>
        {myVehicles && myVehicles.length > 0 ? (
          myVehicles.map((vehicle) => (
            <p key={vehicle.fleet_number}>
              <strong>
                {vehicle.fleet_number} · {vehicle.registration}
              </strong>
              <br />
              {[vehicle.make, vehicle.model].filter(Boolean).join(" ")} —{" "}
              <span className="badge">{vehicle.status}</span>
            </p>
          ))
        ) : (
          <p className="hint">No vehicle assigned to you yet.</p>
        )}
        <Link className="tile tile-alert" href="/breakdowns/new">
          <div className="value">🔴 BREAKDOWN</div>
          <div className="label">Report a roadside breakdown now</div>
        </Link>
        <div className="grid">
          <Link className="tile" href="/check">
            <div className="label">Daily check</div>
            <div className="value">Start</div>
          </Link>
          <Link className="tile" href="/faults/new">
            <div className="label">Report fault</div>
            <div className="value">Report</div>
          </Link>
          <Link className="tile" href="/inspections">
            <div className="label">My inspection history</div>
            <div className="value">View</div>
          </Link>
        </div>
      </div>,
    );
  }

  if (hasRole(roles, "plant_operator")) {
    const { data: myPlant } = await supabase
      .from("plant")
      .select("asset_number, plant_type, make, model, status")
      .eq("assigned_operator_id", userId)
      .eq("voided", false)
      .order("asset_number");

    panels.push(
      <div className="card" key="plant_operator">
        <h2>Plant Operator — My Plant</h2>
        <p className="hint">Same shape as Driver, hours instead of mileage.</p>
        {myPlant && myPlant.length > 0 ? (
          myPlant.map((plant) => (
            <p key={plant.asset_number}>
              <strong>
                {plant.asset_number}
                {plant.plant_type ? ` · ${plant.plant_type}` : ""}
              </strong>
              <br />
              {[plant.make, plant.model].filter(Boolean).join(" ")} —{" "}
              <span className="badge">{plant.status}</span>
            </p>
          ))
        ) : (
          <p className="hint">No plant assigned to you yet.</p>
        )}
        <div className="grid">
          <Link className="tile" href="/check">
            <div className="label">Daily check</div>
            <div className="value">Start</div>
          </Link>
          <Link className="tile" href="/faults/new">
            <div className="label">Report fault</div>
            <div className="value">Report</div>
          </Link>
          <Link className="tile" href="/inspections">
            <div className="label">My inspection history</div>
            <div className="value">View</div>
          </Link>
        </div>
      </div>,
    );
  }

  if (hasRole(roles, "mechanic")) {
    const [{ count: myJobs }, { count: unassigned }, { count: openBreakdowns }] =
      await Promise.all([
        supabase
          .from("faults")
          .select("*", { count: "exact", head: true })
          .eq("assigned_mechanic_id", userId)
          .not("status", "in", "(closed,completed)"),
        supabase
          .from("faults")
          .select("*", { count: "exact", head: true })
          .is("assigned_mechanic_id", null)
          .eq("status", "reported"),
        supabase
          .from("breakdowns")
          .select("*", { count: "exact", head: true })
          .is("returned_to_service_at", null),
      ]);

    panels.push(
      <div className="card" key="mechanic">
        <h2>Mechanic — Workshop</h2>
        <p className="hint">Tablet / workshop PC.</p>
        <div className="grid">
          <Link className="tile" href="/faults">
            <div className="label">My open jobs</div>
            <div className="value">{myJobs ?? 0}</div>
          </Link>
          <Link className="tile" href="/faults">
            <div className="label">Unassigned faults</div>
            <div className="value">{unassigned ?? 0}</div>
          </Link>
          <Link className="tile" href="/check">
            <div className="label">Daily check</div>
            <div className="value">Start</div>
          </Link>
          <Link className="tile" href="/inspections/new">
            <div className="label">13-week / pre-test</div>
            <div className="value">Start</div>
          </Link>
          <Link className="tile" href="/services/new">
            <div className="label">Log a service</div>
            <div className="value">Add</div>
          </Link>
          <Link className="tile" href="/breakdowns">
            <div className="label">Open breakdowns</div>
            <div
              className="value"
              style={{
                color: (openBreakdowns ?? 0) > 0 ? "var(--danger)" : undefined,
              }}
            >
              {openBreakdowns ?? 0}
            </div>
          </Link>
        </div>
      </div>,
    );
  }

  if (isManager(roles)) {
    const [
      { count: vehicles },
      { count: plant },
      { count: openFaults },
      { count: openBreakdowns },
      { data: compliance },
      { data: svcVehicles },
      { data: svcPlant },
    ] = await Promise.all([
      supabase.from("vehicles").select("*", { count: "exact", head: true }),
      supabase.from("plant").select("*", { count: "exact", head: true }),
      supabase
        .from("faults")
        .select("*", { count: "exact", head: true })
        .not("status", "in", "(closed,completed)"),
      supabase
        .from("breakdowns")
        .select("*", { count: "exact", head: true })
        .is("returned_to_service_at", null),
      supabase.from("compliance_items").select("due_date").eq("voided", false),
      supabase
        .from("vehicles")
        .select("next_service_date, next_service_mileage, current_mileage")
        .eq("voided", false),
      supabase
        .from("plant")
        .select("next_service_date, next_service_hours, current_hours")
        .eq("voided", false),
    ]);

    const today = new Date();
    const in14 = new Date();
    in14.setDate(today.getDate() + 14);
    let red = 0;
    let amber = 0;
    for (const row of compliance ?? []) {
      const due = new Date(row.due_date as string);
      if (due < today) red++;
      else if (due <= in14) amber++;
    }

    let serviceDue = 0;
    for (const v of svcVehicles ?? []) {
      const overDate = v.next_service_date && new Date(v.next_service_date) < today;
      const overKm =
        v.next_service_mileage != null &&
        v.current_mileage != null &&
        v.current_mileage >= v.next_service_mileage;
      if (overDate || overKm) serviceDue++;
    }
    for (const p of svcPlant ?? []) {
      const overDate = p.next_service_date && new Date(p.next_service_date) < today;
      const overHrs =
        p.next_service_hours != null &&
        p.current_hours != null &&
        p.current_hours >= p.next_service_hours;
      if (overDate || overHrs) serviceDue++;
    }

    panels.push(
      <div className="card" key="manager">
        <h2>
          {hasRole(roles, "admin") ? "Admin / Management" : "Transport Manager"} —
          Fleet Overview
        </h2>
        <p className="hint">
          Full fleet visibility. Manage:{" "}
          <Link href="/vehicles">Vehicles</Link> ·{" "}
          <Link href="/plant">Plant</Link> ·{" "}
          <Link href="/trailers">Trailers</Link> ·{" "}
          <Link href="/compliance">Compliance</Link> ·{" "}
          <Link href="/checklists">Checklists</Link> ·{" "}
          <Link href="/faults">Faults</Link> ·{" "}
          <Link href="/inspections">Inspections</Link> ·{" "}
          <Link href="/services">Services</Link> ·{" "}
          <Link href="/documents">Documents</Link> ·{" "}
          <Link href="/breakdowns">Breakdowns</Link> ·{" "}
          <Link href="/reports">Reports</Link>
        </p>
        <div className="grid">
          <div className="tile">
            <div className="label">Vehicles</div>
            <div className="value">{vehicles ?? 0}</div>
          </div>
          <div className="tile">
            <div className="label">Plant</div>
            <div className="value">{plant ?? 0}</div>
          </div>
          <Link className="tile" href="/faults">
            <div className="label">Open faults</div>
            <div className="value">{openFaults ?? 0}</div>
          </Link>
          <Link className="tile" href="/breakdowns">
            <div className="label">Open breakdowns</div>
            <div
              className="value"
              style={{
                color: (openBreakdowns ?? 0) > 0 ? "var(--danger)" : undefined,
              }}
            >
              {openBreakdowns ?? 0}
            </div>
          </Link>
          <Link className="tile" href="/compliance?status=red">
            <div className="label">Compliance overdue</div>
            <div className="value" style={{ color: "var(--danger)" }}>
              {red}
            </div>
          </Link>
          <Link className="tile" href="/compliance?status=amber">
            <div className="label">Compliance due &le; 14d</div>
            <div className="value" style={{ color: "var(--amber)" }}>
              {amber}
            </div>
          </Link>
          <div className="tile">
            <div className="label">Service due / overdue</div>
            <div
              className="value"
              style={{ color: serviceDue > 0 ? "var(--danger)" : undefined }}
            >
              {serviceDue}
            </div>
          </div>
        </div>
      </div>,
    );
  }

  if (hasRole(roles, "admin")) {
    panels.push(
      <div className="card" key="admin">
        <h2>Admin — System</h2>
        <p className="hint">Admin-only areas.</p>
        <div className="grid">
          <Link className="tile" href="/admin/users">
            <div className="label">Users &amp; roles</div>
            <div className="value">Manage</div>
          </Link>
          <Link className="tile" href="/checklists">
            <div className="label">Checklist templates</div>
            <div className="value">Edit</div>
          </Link>
          <div className="tile">
            <div className="label">Audit log</div>
            <div className="value">Later</div>
          </div>
        </div>
      </div>,
    );
  }

  return <>{panels}</>;
}
