"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FAULT_SEVERITIES, FAULT_SEVERITY_LABELS } from "@/lib/inspections";
import type { AssetOption } from "@/lib/asset-picker";
import { reportFault, type FormState } from "./actions";

export function FaultForm({
  assets,
  defaultAsset,
  cancelHref,
}: {
  assets: AssetOption[];
  defaultAsset?: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    reportFault,
    {},
  );

  const groups = [...new Set(assets.map((a) => a.group))];

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="asset">
          Asset <span className="req">*</span>
        </label>
        <select
          id="asset"
          name="asset"
          required
          defaultValue={defaultAsset ?? ""}
        >
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

      <div className="field">
        <label htmlFor="description">
          What&apos;s wrong? <span className="req">*</span>
        </label>
        <textarea id="description" name="description" required />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="severity">Severity</label>
          <select id="severity" name="severity" defaultValue="normal">
            {FAULT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {FAULT_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <input
            id="category"
            name="category"
            placeholder="Brakes, Electrical, Body…"
          />
        </div>
        <div className="field">
          <label htmlFor="location">Location</label>
          <input id="location" name="location" placeholder="Yard, on route…" />
        </div>
      </div>

      <div className="field">
        <label>Is the asset safe to operate?</label>
        <div className="choices" style={{ maxWidth: 280 }}>
          <label className="pass">
            <input
              type="radio"
              name="safe_to_operate"
              value="yes"
              defaultChecked
            />
            Yes
          </label>
          <label className="fail">
            <input type="radio" name="safe_to_operate" value="no" />
            No
          </label>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Report fault"}
        </button>
        <Link className="btn ghost" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
