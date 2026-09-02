"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AssetOption } from "@/lib/asset-picker";
import { COMPLIANCE_TYPES, COMPLIANCE_TYPE_LABELS } from "@/lib/compliance";
import type { FormState } from "./actions";

type Defaults = {
  asset?: string;
  compliance_type?: string;
  due_date?: string | null;
  last_completed_date?: string | null;
  notes?: string | null;
};

export function ComplianceForm({
  action,
  assets,
  defaults = {},
  lockAsset = false,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  assets: AssetOption[];
  defaults?: Defaults;
  lockAsset?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const groups = [...new Set(assets.map((a) => a.group))];

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      {lockAsset ? (
        <input type="hidden" name="asset" value={defaults.asset} />
      ) : (
        <div className="field">
          <label htmlFor="asset">
            Asset <span className="req">*</span>
          </label>
          <select
            id="asset"
            name="asset"
            required
            defaultValue={defaults.asset ?? ""}
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
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="compliance_type">
            Type <span className="req">*</span>
          </label>
          <select
            id="compliance_type"
            name="compliance_type"
            required
            defaultValue={defaults.compliance_type ?? ""}
          >
            <option value="">— Choose —</option>
            {COMPLIANCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMPLIANCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="due_date">
            Due date <span className="req">*</span>
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            required
            defaultValue={defaults.due_date ?? undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="last_completed_date">Last completed</label>
          <input
            id="last_completed_date"
            name="last_completed_date"
            type="date"
            defaultValue={defaults.last_completed_date ?? undefined}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={defaults.notes ?? undefined}
        />
      </div>

      <div className="btn-row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link className="btn ghost" href="/compliance">
          Cancel
        </Link>
      </div>
    </form>
  );
}
