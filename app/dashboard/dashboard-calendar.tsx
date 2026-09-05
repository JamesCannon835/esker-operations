import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import { LEAVE_TYPE_LABELS } from "@/lib/leave";
import { EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/calendar";
import {
  COMPLIANCE_TYPE_LABELS,
  type ComplianceType,
} from "@/lib/compliance";

const WINDOW_DAYS = 14;
const CAL_COMPLIANCE: ComplianceType[] = [
  "cvrt_test",
  "tax",
  "thirteen_week_inspection",
  "tacho_calibration",
];

type Item = { kind: "leave" | "event" | "compliance"; label: string };

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Next two weeks of the company calendar, for the manager dashboard. */
export async function DashboardCalendar() {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + WINDOW_DAYS - 1);
  const from = iso(today);
  const to = iso(end);

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
      .lte("start_date", to)
      .gte("end_date", from),
    supabase.from("users").select("id, full_name"),
    supabase
      .from("calendar_events")
      .select("title, category, start_date, end_date")
      .lte("start_date", to)
      .gte("end_date", from),
    supabase
      .from("compliance_items")
      .select("asset_type, asset_id, compliance_type, due_date")
      .eq("voided", false)
      .in("compliance_type", CAL_COMPLIANCE)
      .gte("due_date", from)
      .lte("due_date", to),
    supabase.from("vehicles").select("id, fleet_number, registration"),
  ]);

  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));
  const regOf = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      vehicleName(v.fleet_number, v.registration),
    ]),
  );

  // day iso -> items
  const byDay = new Map<string, Item[]>();
  const add = (day: string, it: Item) => {
    const l = byDay.get(day) ?? [];
    l.push(it);
    byDay.set(day, l);
  };
  const spanDays = (s: string, e: string, fn: (day: string) => void) => {
    const start = new Date(`${s}T00:00:00`);
    const stop = new Date(`${e}T00:00:00`);
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (d >= start && d <= stop) fn(iso(d));
    }
  };

  for (const r of leave ?? [])
    spanDays(r.start_date, r.end_date, (day) =>
      add(day, {
        kind: "leave",
        label: `${nameOf.get(r.user_id) ?? "—"} off${
          r.leave_type === "sick" ? " (sick)" : ""
        }`,
      }),
    );
  for (const ev of events ?? [])
    spanDays(ev.start_date, ev.end_date, (day) =>
      add(day, {
        kind: "event",
        label: `${ev.title} · ${
          EVENT_CATEGORY_LABELS[ev.category as EventCategory]
        }`,
      }),
    );
  for (const c of compliance ?? []) {
    const who = c.asset_type === "vehicle" ? regOf.get(c.asset_id) ?? "" : "";
    add(c.due_date.slice(0, 10), {
      kind: "compliance",
      label: `${who ? who + " " : ""}${
        COMPLIANCE_TYPE_LABELS[c.compliance_type as ComplianceType]
      } due`,
    });
  }

  const days: { iso: string; label: string; items: Item[] }[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = iso(d);
    const items = byDay.get(key);
    if (!items || items.length === 0) continue;
    days.push({
      iso: key,
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-IE", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
      items,
    });
  }

  return (
    <div className="card">
      <div className="page-head" style={{ marginBottom: 8 }}>
        <h2>Calendar — next 2 weeks</h2>
        <Link className="btn small ghost" href="/leave/calendar">
          Full calendar
        </Link>
      </div>
      {days.length === 0 ? (
        <p className="empty">Nothing on in the next two weeks.</p>
      ) : (
        <div className="dash-cal">
          {days.map((d) => (
            <div className="dash-cal-day" key={d.iso}>
              <div className="dash-cal-date">{d.label}</div>
              <ul>
                {d.items.map((it, j) => (
                  <li key={j} className={`dash-cal-${it.kind}`}>
                    {it.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
