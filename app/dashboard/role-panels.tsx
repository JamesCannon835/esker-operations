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
        <div className="grid">
          <Link className="tile" href="/check">
            <div className="label">Daily check</div>
            <div className="value">Start</div>
          </Link>
          <Link className="tile" href="/faults/new">
            <div className="label">Report fault</div>
            <div className="value">Report</div>
          </Link>
          <div className="tile">
            <div className="label">Breakdown</div>
            <div className="value">Phase 7</div>
          </div>
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
    const [{ count: myJobs }, { count: unassigned }] = await Promise.all([
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
          <div className="tile">
            <div className="label">13-week / pre-test</div>
            <div className="value">Phase 5</div>
          </div>
        </div>
      </div>,
    );
  }

  if (isManager(roles)) {
    const [
      { count: vehicles },
      { count: plant },
      { count: openFaults },
      { data: compliance },
    ] = await Promise.all([
      supabase.from("vehicles").select("*", { count: "exact", head: true }),
      supabase.from("plant").select("*", { count: "exact", head: true }),
      supabase
        .from("faults")
        .select("*", { count: "exact", head: true })
        .not("status", "in", "(closed,completed)"),
      supabase.from("compliance_items").select("due_date").eq("voided", false),
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
          <Link href="/checklists">Checklists</Link> ·{" "}
          <Link href="/faults">Faults</Link> ·{" "}
          <Link href="/inspections">Inspections</Link>
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
          <div className="tile">
            <div className="label">Open faults</div>
            <div className="value">{openFaults ?? 0}</div>
          </div>
          <div className="tile">
            <div className="label">Compliance overdue</div>
            <div className="value" style={{ color: "var(--red)" }}>
              {red}
            </div>
          </div>
          <div className="tile">
            <div className="label">Compliance due &le; 14d</div>
            <div className="value" style={{ color: "var(--amber)" }}>
              {amber}
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
          <div className="tile">
            <div className="label">Users &amp; roles</div>
            <div className="value">Phase 1+</div>
          </div>
          <div className="tile">
            <div className="label">Audit log</div>
            <div className="value">Phase 6</div>
          </div>
          <div className="tile">
            <div className="label">Checklist templates</div>
            <div className="value">Phase 3</div>
          </div>
        </div>
      </div>,
    );
  }

  return <>{panels}</>;
}
