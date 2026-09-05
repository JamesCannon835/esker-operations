import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { vehicleName } from "@/lib/asset-name";
import { LEAVE_TYPE_LABELS } from "@/lib/leave";
import { EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/calendar";
import {
  COMPLIANCE_TYPE_LABELS,
  type ComplianceType,
} from "@/lib/compliance";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Compliance dates worth surfacing on the calendar.
const CAL_COMPLIANCE: ComplianceType[] = [
  "cvrt_test",
  "tax",
  "thirteen_week_inspection",
  "tacho_calibration",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type Marker =
  | { kind: "leave"; label: string; sick: boolean }
  | { kind: "event"; label: string; category: EventCategory }
  | { kind: "compliance"; label: string };

export default async function LeaveCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  await requireManager();
  const supabase = await createClient();

  const { m } = await searchParams;
  const now = new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? "");
  let year = match ? Number(match[1]) : now.getFullYear();
  let month = match ? Number(match[2]) - 1 : now.getMonth();
  if (month < 0 || month > 11) {
    year = now.getFullYear();
    month = now.getMonth();
  }

  const monthStart = `${year}-${pad(month + 1)}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;

  const [
    { data: leave },
    { data: people },
    { data: events },
    { data: compliance },
    { data: vehicles },
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("user_id, leave_type, start_date, end_date")
      .eq("status", "approved")
      .lte("start_date", monthEnd)
      .gte("end_date", monthStart),
    supabase.from("users").select("id, full_name"),
    supabase
      .from("calendar_events")
      .select("id, title, category, start_date, end_date, note")
      .lte("start_date", monthEnd)
      .gte("end_date", monthStart)
      .order("start_date"),
    supabase
      .from("compliance_items")
      .select("asset_type, asset_id, compliance_type, due_date")
      .eq("voided", false)
      .in("compliance_type", CAL_COMPLIANCE)
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd),
    supabase.from("vehicles").select("id, fleet_number, registration"),
  ]);

  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));
  const regOf = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      vehicleName(v.fleet_number, v.registration),
    ]),
  );

  const byDay = new Map<number, Marker[]>();
  const push = (day: number, mk: Marker) => {
    const list = byDay.get(day) ?? [];
    list.push(mk);
    byDay.set(day, list);
  };
  const spanDays = (startISO: string, endISO: string, fn: (day: number) => void) => {
    const s = new Date(`${startISO}T00:00:00`);
    const e = new Date(`${endISO}T00:00:00`);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d >= s && d <= e) fn(day);
    }
  };

  for (const r of leave ?? []) {
    spanDays(r.start_date, r.end_date, (day) =>
      push(day, {
        kind: "leave",
        label: nameOf.get(r.user_id) ?? "—",
        sick: r.leave_type === "sick",
      }),
    );
  }
  for (const ev of events ?? []) {
    spanDays(ev.start_date, ev.end_date, (day) =>
      push(day, {
        kind: "event",
        label: ev.title,
        category: ev.category as EventCategory,
      }),
    );
  }
  for (const c of compliance ?? []) {
    const day = Number(c.due_date.slice(8, 10));
    const who =
      c.asset_type === "vehicle" ? regOf.get(c.asset_id) ?? "" : "";
    push(day, {
      kind: "compliance",
      label: `${who ? who + " " : ""}${
        COMPLIANCE_TYPE_LABELS[c.compliance_type as ComplianceType]
      } due`,
    });
  }

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = month === 0 ? `${year - 1}-12` : `${year}-${pad(month)}`;
  const next = month === 11 ? `${year + 1}-01` : `${year}-${pad(month + 2)}`;
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <>
      <Link className="link-back" href="/leave">
        ← Time off
      </Link>
      <div className="page-head">
        <h1>
          {MONTH_NAMES[month]} {year}
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn small" href="/leave/calendar/new">
            + New entry
          </Link>
          <Link className="btn small ghost" href={`/leave/calendar?m=${prev}`}>
            ←
          </Link>
          <Link className="btn small ghost" href="/leave/calendar">
            Today
          </Link>
          <Link className="btn small ghost" href={`/leave/calendar?m=${next}`}>
            →
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="cal-grid cal-head">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">
              {w}
            </div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="cal-cell empty" />;
            const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
            const list = byDay.get(day) ?? [];
            return (
              <div
                key={i}
                className={`cal-cell${iso === todayKey ? " today" : ""}`}
              >
                <div className="cal-day-num">{day}</div>
                {list.map((mk, j) => (
                  <div
                    key={j}
                    className={
                      mk.kind === "leave"
                        ? `cal-name${mk.sick ? " sick" : ""}`
                        : mk.kind === "compliance"
                          ? "cal-name compliance"
                          : "cal-name event"
                    }
                    title={
                      mk.kind === "event"
                        ? EVENT_CATEGORY_LABELS[mk.category]
                        : mk.kind === "leave"
                          ? "Time off"
                          : "Compliance due"
                    }
                  >
                    {mk.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Entries this month</h2>
        {!events || events.length === 0 ? (
          <p className="empty">
            No diary entries. <Link href="/leave/calendar/new">Add one</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>What</th>
                <th>When</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    {ev.title}
                    {ev.note && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {ev.note}
                      </div>
                    )}
                  </td>
                  <td className="muted">
                    {fmtDate(ev.start_date)}
                    {ev.end_date !== ev.start_date
                      ? ` – ${fmtDate(ev.end_date)}`
                      : ""}
                  </td>
                  <td className="muted">
                    {EVENT_CATEGORY_LABELS[ev.category as EventCategory]}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      className="btn ghost small"
                      href={`/leave/calendar/${ev.id}`}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="hint">
        Approved time off, company diary entries and upcoming vehicle test / tax
        dates. Management only — drivers never see this page.
      </p>
    </>
  );
}
