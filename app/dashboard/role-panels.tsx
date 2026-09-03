import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isManager, hasRole, type Role } from "@/lib/roles";
import { fmtDate } from "@/lib/format";
import { trainingStatus } from "@/lib/training";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/compliance";

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

  if (hasRole(roles, "driver") || hasRole(roles, "plant_operator")) {
    panels.push(
      <div className="card" key="field">
        <h2>Your day</h2>
        <p className="hint">
          Do your daily check. Mark anything wrong on the check — it becomes a
          fault for the workshop automatically.
        </p>

        <Link
          className="tile"
          href="/check"
          style={{ padding: "18px 16px", textAlign: "center" }}
        >
          <div className="value" style={{ fontSize: 20 }}>
            Start daily check
          </div>
        </Link>

        <div className="grid">
          <Link className="tile" href="/faults/new">
            <div className="label">Report a fault</div>
            <div className="value">Report</div>
          </Link>
          <Link className="tile" href="/faults">
            <div className="label">My faults</div>
            <div className="value">View</div>
          </Link>
          <Link className="tile" href="/inspections">
            <div className="label">My checks</div>
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
          <Link className="tile" href="/inspections/new">
            <div className="label">New inspection</div>
            <div className="value">Start</div>
          </Link>
          <Link className="tile" href="/compliance">
            <div className="label">Compliance</div>
            <div className="value">View</div>
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
          <Link href="/documents">Documents</Link> ·{" "}
          <Link href="/training">Training</Link> ·{" "}
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

  // Everyone sees their own safety training.
  const { data: training } = await supabase
    .from("training_records")
    .select("id, course_name, completed_date, expiry_date, certificate_name")
    .eq("user_id", userId)
    .eq("voided", false)
    .order("completed_date", { ascending: false });

  panels.push(
    <div className="card" key="my-training">
      <h2>Your safety training</h2>
      {!training || training.length === 0 ? (
        <p className="hint">
          Nothing recorded yet. Your transport manager keeps this up to date.
        </p>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Completed</th>
              <th>Expires</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {training.map((t) => {
              const s = trainingStatus(t.expiry_date);
              return (
                <tr key={t.id}>
                  <td>{t.course_name}</td>
                  <td className="muted">{fmtDate(t.completed_date)}</td>
                  <td className="muted">
                    {t.expiry_date ? fmtDate(t.expiry_date) : "—"}
                  </td>
                  <td
                    style={
                      s === "red"
                        ? { color: "var(--danger)", fontWeight: 600 }
                        : s === "amber"
                          ? { color: "var(--amber)", fontWeight: 600 }
                          : undefined
                    }
                  >
                    {t.expiry_date ? COMPLIANCE_STATUS_LABELS[s] : "Valid"}
                  </td>
                  <td>
                    {t.certificate_name && (
                      <Link href={`/training/${t.id}/certificate`}>
                        Certificate
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>,
  );

  return <>{panels}</>;
}
