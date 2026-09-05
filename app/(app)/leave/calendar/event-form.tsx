"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  type CalendarEvent,
} from "@/lib/calendar";
import type { FormState } from "./actions";

type VehicleOption = { id: string; label: string };

export function EventForm({
  action,
  vehicles,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  vehicles: VehicleOption[];
  defaults?: Partial<CalendarEvent>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? {};

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="title">
          What&apos;s happening <span className="req">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={d.title ?? ""}
          placeholder="e.g. 12D1234 CVRT test"
        />
      </div>

      <div className="field">
        <label htmlFor="category">Type</label>
        <select
          id="category"
          name="category"
          defaultValue={d.category ?? "other"}
        >
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EVENT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="start_date">
          Date <span className="req">*</span>
        </label>
        <input
          id="start_date"
          name="start_date"
          type="date"
          required
          defaultValue={d.start_date ?? ""}
        />
      </div>

      <div className="field">
        <label htmlFor="end_date">End date (leave blank for a single day)</label>
        <input
          id="end_date"
          name="end_date"
          type="date"
          defaultValue={
            d.end_date && d.end_date !== d.start_date ? d.end_date : ""
          }
        />
      </div>

      <div className="field">
        <label htmlFor="asset_id">Vehicle (optional)</label>
        <select
          id="asset_id"
          name="asset_id"
          defaultValue={d.asset_id ?? ""}
        >
          <option value="">— none —</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="note">Note (optional)</label>
        <textarea id="note" name="note" rows={2} defaultValue={d.note ?? ""} />
      </div>

      <div className="btn-row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="btn ghost" href="/leave/calendar">
          Cancel
        </Link>
      </div>
    </form>
  );
}
