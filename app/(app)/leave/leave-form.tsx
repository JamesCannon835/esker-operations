"use client";

import { useActionState, useState } from "react";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, workingDaysBetween } from "@/lib/leave";
import type { FormState } from "./actions";

type PersonOption = { id: string; full_name: string };

export function LeaveForm({
  action,
  people,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  /** When given, the form shows a person picker (manager booking for staff). */
  people?: PersonOption[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const days = start && end ? workingDaysBetween(start, end) : 0;

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      {people && (
        <div className="field">
          <label htmlFor="user_id">
            Person <span className="req">*</span>
          </label>
          <select id="user_id" name="user_id" required defaultValue="">
            <option value="">— Choose person —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="leave_type">Type</label>
        <select id="leave_type" name="leave_type" defaultValue="annual">
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEAVE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="start_date">
          First day off <span className="req">*</span>
        </label>
        <input
          type="date"
          id="start_date"
          name="start_date"
          required
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            if (end && e.target.value > end) setEnd(e.target.value);
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="end_date">
          Last day off <span className="req">*</span>
        </label>
        <input
          type="date"
          id="end_date"
          name="end_date"
          required
          min={start || undefined}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>

      {days > 0 && (
        <p className="hint">
          {days} working day{days === 1 ? "" : "s"} (Mon–Fri). Weekends aren&apos;t
          counted.
        </p>
      )}

      <div className="field">
        <label htmlFor="reason">Note (optional)</label>
        <textarea id="reason" name="reason" rows={2} />
      </div>

      <button className="btn" type="submit" disabled={days === 0}>
        {submitLabel}
      </button>
    </form>
  );
}
