"use client";

import { useActionState } from "react";
import { saveSettings, type FormState } from "./actions";

export function SettingsForm({ rate }: { rate: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveSettings,
    {},
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      {state.ok && <div className="ok">{state.ok}</div>}

      <div className="field">
        <label htmlFor="labour_rate_per_hour">Yard labour rate (€ per hour)</label>
        <input
          id="labour_rate_per_hour"
          name="labour_rate_per_hour"
          type="number"
          step="any"
          inputMode="decimal"
          defaultValue={rate}
        />
        <div className="field-hint">
          Used to cost workshop time on each vehicle, plant item and trailer.
          Set to 0 to show hours only.
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
