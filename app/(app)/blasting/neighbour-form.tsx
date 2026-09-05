"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "./actions";

export function NeighbourForm({
  action,
  defaults,
  submitLabel,
  compact,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: {
    name?: string;
    phone?: string;
    address?: string | null;
    notes?: string | null;
    active?: boolean;
  };
  submitLabel: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? { active: true };

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="name">
          Name <span className="req">*</span>
        </label>
        <input id="name" name="name" type="text" required defaultValue={d.name ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="phone">
          Mobile <span className="req">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          defaultValue={d.phone ?? ""}
          placeholder="087 123 4567"
        />
      </div>

      <div className="field">
        <label htmlFor="address">Address</label>
        <input
          id="address"
          name="address"
          type="text"
          defaultValue={d.address ?? ""}
        />
      </div>

      {!compact && (
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={d.notes ?? ""} />
        </div>
      )}

      <div className="field">
        <label className="tb-confirm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={d.active ?? true}
          />{" "}
          On the notification list
        </label>
      </div>

      <div className="btn-row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="btn ghost" href="/blasting/neighbours">
          Cancel
        </Link>
      </div>
    </form>
  );
}
