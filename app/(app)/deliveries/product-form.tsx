"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

export function ProductForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: {
    name?: string;
    unit?: string;
    unit_price?: number | null;
    active?: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? { active: true, unit: "tonne" };

  return (
    <form action={formAction} className="del-grid" style={{ alignItems: "end" }}>
      {state.error && (
        <div className="error" style={{ gridColumn: "1 / -1" }}>
          {state.error}
        </div>
      )}
      <label>
        Product
        <input name="name" required defaultValue={d.name ?? ""} placeholder="e.g. 6mm stone" />
      </label>
      <label>
        Unit
        <input name="unit" defaultValue={d.unit ?? "tonne"} />
      </label>
      <label>
        Price / unit (€)
        <input
          name="unit_price"
          type="number"
          step="0.01"
          inputMode="decimal"
          defaultValue={d.unit_price ?? ""}
        />
      </label>
      <label className="tb-confirm">
        <input type="checkbox" name="active" defaultChecked={d.active ?? true} />{" "}
        Active
      </label>
      <button className="btn small" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
