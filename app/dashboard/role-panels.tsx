import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isManager, hasRole, type Role } from "@/lib/roles";
import { fmtDate } from "@/lib/format";
import { trainingStatus } from "@/lib/training";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/compliance";
import { getLeaveBalance } from "@/lib/leave-server";
import { canSeeTasks } from "@/lib/tasks";
import { AreaHub } from "./area-hub";
import { DashboardCalendar } from "./dashboard-calendar";

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

  if (hasRole(roles, "plant_operator") || hasRole(roles, "yard_staff")) {
    const [{ count: mineOpen }, { count: unassignedOpen }] = await Promise.all([
      supabase
        .from("precast_orders")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .in("status", ["new", "in_progress"]),
      supabase
        .from("precast_orders")
        .select("*", { count: "exact", head: true })
        .is("assigned_to", null)
        .in("status", ["new", "in_progress"]),
    ]);
    const precastOpen = (mineOpen ?? 0) + (unassignedOpen ?? 0);

    panels.push(
      <div className="card" key="yard">
        <h2>Yard</h2>
        {(mineOpen ?? 0) > 0 ? (
          <Link
            className="tile tile-alert"
            href="/precast"
            style={{ display: "block" }}
          >
            <div className="value">
              {mineOpen} precast order{mineOpen === 1 ? "" : "s"} for you
            </div>
            <div className="label">Assigned to you — tap to open</div>
          </Link>
        ) : (
          (unassignedOpen ?? 0) > 0 && (
            <Link
              className="tile tile-alert"
              href="/precast"
              style={{ display: "block" }}
            >
              <div className="value">
                {unassignedOpen} precast order
                {unassignedOpen === 1 ? "" : "s"} to make
              </div>
              <div className="label">Tap to open</div>
            </Link>
          )
        )}
        <div className="grid">
          <Link className="tile" href="/verti-block/sheets">
            <div className="label">Production sheet</div>
            <div className="value">Open</div>
          </Link>
          <Link className="tile" href="/verti-block/loads">
            <div className="label">Load builder</div>
            <div className="value">Build</div>
          </Link>
          <Link className="tile" href="/precast">
            <div className="label">Precast orders</div>
            <div className="value">{precastOpen ?? 0}</div>
          </Link>
          <Link className="tile" href="/faults/new">
            <div className="label">Report a fault</div>
            <div className="value">Report</div>
          </Link>
        </div>
      </div>,
    );
  }

  if (hasRole(roles, "mechanic")) {
    const [
      { count: myJobs },
      { count: unassigned },
      { count: myActions },
      { count: drafts },
      { count: inspDrafts },
    ] = await Promise.all([
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
        .from("actions")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .in("status", ["open", "in_progress"]),
      supabase
        .from("maintenance_reports")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId)
        .eq("status", "draft"),
      supabase
        .from("vehicle_inspections")
        .select("*", { count: "exact", head: true })
        .eq("inspector_id", userId)
        .eq("status", "draft"),
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
          <Link className="tile" href="/maintenance?show=drafts">
            <div className="label">Draft reports</div>
            <div className="value">{drafts ?? 0}</div>
          </Link>
          <Link className="tile" href="/actions?show=mine">
            <div className="label">My actions</div>
            <div className="value">{myActions ?? 0}</div>
          </Link>
          <Link className="tile" href="/vehicle-inspections">
            <div className="label">Inspections in progress</div>
            <div className="value">{inspDrafts ?? 0}</div>
          </Link>
          <Link className="tile" href="/vehicle-inspections/new">
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
    panels.push(<AreaHub key="hub" isAdmin={hasRole(roles, "admin")} />);
    panels.push(<DashboardCalendar key="cal" />);

    const [
      { count: vehicles },
      { count: plant },
      { count: openFaults },
      { data: compliance },
      { data: svcVehicles },
      { data: svcPlant },
      { count: openActions },
      { count: offRoad },
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
      supabase
        .from("actions")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]),
      supabase
        .from("vehicles")
        .select("*", { count: "exact", head: true })
        .eq("status", "off_road")
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
        <h2>At a glance</h2>
        <p className="hint">Where things stand right now — tap a number to jump in.</p>
        <div className="grid">
          <Link className="tile" href="/vehicles">
            <div className="label">Vehicles</div>
            <div className="value">{vehicles ?? 0}</div>
          </Link>
          <Link className="tile" href="/plant">
            <div className="label">Plant</div>
            <div className="value">{plant ?? 0}</div>
          </Link>
          <Link className="tile" href="/trailers">
            <div className="label">Trailers</div>
            <div className="value">View</div>
          </Link>
          <Link className="tile" href="/faults">
            <div className="label">Open faults</div>
            <div className="value">{openFaults ?? 0}</div>
          </Link>
          <Link className="tile" href="/maintenance?show=oos">
            <div className="label">Vehicles off road</div>
            <div
              className="value"
              style={{ color: (offRoad ?? 0) > 0 ? "var(--danger)" : undefined }}
            >
              {offRoad ?? 0}
            </div>
          </Link>
          <Link className="tile" href="/actions?show=open">
            <div className="label">Open actions</div>
            <div className="value">{openActions ?? 0}</div>
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
          <Link className="tile" href="/admin/settings">
            <div className="label">Settings</div>
            <div className="value">Edit</div>
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

  // Tasks assigned to me (not drivers).
  const { data: myTasks } = canSeeTasks(roles)
    ? await supabase
        .from("actions")
        .select("id, title, due_date, priority")
        .eq("assigned_to", userId)
        .in("status", ["open", "in_progress"])
        .order("due_date", { nullsFirst: false })
        .limit(8)
    : { data: null };
  if (myTasks && myTasks.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    panels.push(
      <div className="card" key="my-tasks">
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2>Your tasks</h2>
          <Link className="btn ghost small" href="/actions">
            All
          </Link>
        </div>
        <table className="list-table">
          <tbody>
            {myTasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/actions/${t.id}`}>{t.title}</Link>
                </td>
                <td
                  className={
                    t.due_date && t.due_date < today ? "blocked" : "muted"
                  }
                  style={{ whiteSpace: "nowrap", textAlign: "right" }}
                >
                  {t.due_date ? fmtDate(t.due_date) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }

  // Everyone: outstanding toolbox talks to read & sign.
  const { data: tbRows } = await supabase
    .from("toolbox_talk_recipients")
    .select("signed_at, talk:toolbox_talks(id, title, status)")
    .eq("user_id", userId)
    .is("signed_at", null);
  type TbTalk = { id: string; title: string; status: string };
  const outstanding = ((tbRows ?? []) as { talk: unknown }[])
    .map((r) => (Array.isArray(r.talk) ? r.talk[0] : r.talk) as TbTalk | null)
    .filter((t): t is TbTalk => !!t && t.status === "sent");
  if (outstanding.length > 0) {
    panels.push(
      <div className="card" key="toolbox-todo">
        <h2>Toolbox talks to sign</h2>
        <div className="grid">
          {outstanding.map((t) => (
            <Link className="tile" key={t.id} href={`/toolbox/${t.id}`}>
              <div className="label">{t.title}</div>
              <div className="value">Read &amp; sign</div>
            </Link>
          ))}
        </div>
      </div>,
    );
  }

  // Everyone sees their own time-off balance.
  const leave = await getLeaveBalance(userId);
  panels.push(
    <div className="card" key="my-leave">
      <h2>Your time off</h2>
      <div className="grid">
        <Link className="tile" href="/leave">
          <div className="label">Days left {leave.year}</div>
          <div className="value">{leave.remaining}</div>
        </Link>
        <Link className="tile" href="/leave">
          <div className="label">Booked / taken</div>
          <div className="value">{leave.approved}</div>
        </Link>
        <Link className="tile" href="/leave">
          <div className="label">Awaiting approval</div>
          <div
            className="value"
            style={{ color: leave.pending > 0 ? "var(--amber)" : undefined }}
          >
            {leave.pending}
          </div>
        </Link>
        <Link className="tile" href="/leave">
          <div className="label">Book time off</div>
          <div className="value">Open</div>
        </Link>
      </div>
    </div>,
  );

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
