import { LABOUR_TYPES, LABOUR_TYPE_LABELS } from "@/lib/inspections";

const HOURS = Array.from({ length: 13 }, (_, i) => i); // 0–12
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const today = () => new Date().toISOString().slice(0, 10);

/** Enter labour as hours + minutes — no running timer. */
export function LogTimeForm({
  action,
}: {
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="log-time">
      <div className="field">
        <label htmlFor="lt-type">Work</label>
        <select id="lt-type" name="entry_type" defaultValue="repair">
          {LABOUR_TYPES.map((t) => (
            <option key={t} value={t}>
              {LABOUR_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="lt-hours">Hours</label>
        <select id="lt-hours" name="hours" defaultValue="0">
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="lt-mins">Minutes</label>
        <select id="lt-mins" name="minutes" defaultValue="0">
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="lt-date">Date</label>
        <input id="lt-date" name="work_date" type="date" defaultValue={today()} />
      </div>

      <button className="btn" type="submit">
        Add time
      </button>
    </form>
  );
}
