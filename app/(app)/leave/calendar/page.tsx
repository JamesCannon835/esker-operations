import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_TYPE_LABELS } from "@/lib/leave";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

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
  let month = match ? Number(match[2]) - 1 : now.getMonth(); // 0-based
  if (month < 0 || month > 11) {
    year = now.getFullYear();
    month = now.getMonth();
  }

  const monthStart = `${year}-${pad(month + 1)}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;

  const { data: leave } = await supabase
    .from("leave_requests")
    .select("user_id, leave_type, start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", monthEnd)
    .gte("end_date", monthStart);

  const { data: people } = await supabase.from("users").select("id, full_name");
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));

  // day-of-month (1..n) -> list of { name, type }
  const byDay = new Map<number, { name: string; type: string }[]>();
  for (const r of leave ?? []) {
    const s = new Date(`${r.start_date}T00:00:00`);
    const e = new Date(`${r.end_date}T00:00:00`);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d >= s && d <= e) {
        const list = byDay.get(day) ?? [];
        list.push({
          name: nameOf.get(r.user_id) ?? "—",
          type: r.leave_type as string,
        });
        byDay.set(day, list);
      }
    }
  }

  // Leading blanks so the 1st sits under the right weekday (week starts Monday).
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
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
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn small ghost" href={`/leave/calendar?m=${prev}`}>
            ← Prev
          </Link>
          <Link className="btn small ghost" href="/leave/calendar">
            Today
          </Link>
          <Link className="btn small ghost" href={`/leave/calendar?m=${next}`}>
            Next →
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
                {list.map((p, j) => (
                  <div
                    key={j}
                    className={`cal-name${p.type === "sick" ? " sick" : ""}`}
                    title={LEAVE_TYPE_LABELS[p.type as "annual" | "sick"]}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="hint">
        Shows approved time off. Sick leave is shown in a muted style. Weekends
        are greyed but still listed if a booking spans them.
      </p>
    </>
  );
}
