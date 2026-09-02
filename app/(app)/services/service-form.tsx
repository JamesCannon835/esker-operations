"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AssetOption } from "@/lib/asset-picker";
import { logService, type FormState } from "./actions";

export function ServiceForm({
  assets,
  defaultAsset,
}: {
  assets: AssetOption[];
  defaultAsset?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    logService,
    {},
  );
  const groups = [...new Set(assets.map((a) => a.group))];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="asset">
          Asset <span className="req">*</span>
        </label>
        <select id="asset" name="asset" required defaultValue={defaultAsset ?? ""}>
          <option value="">— Choose asset —</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {assets
                .filter((a) => a.group === g)
                .map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="service_date">
            Service date <span className="req">*</span>
          </label>
          <input
            id="service_date"
            name="service_date"
            type="date"
            required
            defaultValue={today}
          />
        </div>
        <div className="field">
          <label htmlFor="mileage_or_hours">Mileage / hours</label>
          <input
            id="mileage_or_hours"
            name="mileage_or_hours"
            type="number"
            inputMode="numeric"
          />
        </div>
        <div className="field">
          <label htmlFor="cost">Cost (€)</label>
          <input id="cost" name="cost" type="number" step="any" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          placeholder="Work done, oil/filters changed, next service due…"
        />
      </div>

      <div className="btn-row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Log service"}
        </button>
        <Link className="btn ghost" href="/services">
          Cancel
        </Link>
      </div>
    </form>
  );
}
