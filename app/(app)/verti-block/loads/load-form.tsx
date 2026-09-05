"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "./actions";

export function LoadForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: {
    reference?: string | null;
    customer?: string | null;
    load_date?: string | null;
    truck_reg?: string | null;
    max_payload_kg?: number | null;
    notes?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <div className="del-grid">
        <label>
          Order / load reference
          <input name="reference" defaultValue={d.reference ?? ""} />
        </label>
        <label>
          Customer
          <input name="customer" defaultValue={d.customer ?? ""} />
        </label>
        <label>
          Load date
          <input
            type="date"
            name="load_date"
            defaultValue={d.load_date ?? today}
          />
        </label>
        <label>
          Truck reg
          <input name="truck_reg" defaultValue={d.truck_reg ?? ""} />
        </label>
        <label>
          Max payload (kg)
          <input
            type="number"
            step="10"
            inputMode="numeric"
            name="max_payload_kg"
            defaultValue={d.max_payload_kg ?? ""}
            placeholder="e.g. 26000"
          />
        </label>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={d.notes ?? ""} />
      </div>
      <div className="btn-row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="btn ghost" href="/verti-block/loads">
          Cancel
        </Link>
      </div>
    </form>
  );
}
