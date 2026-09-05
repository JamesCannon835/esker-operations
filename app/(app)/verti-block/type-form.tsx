"use client";

import { useActionState } from "react";
import { saveType, type FormState } from "./actions";

export function TypeForm({
  id,
  defaults,
  submitLabel,
}: {
  id: string | null;
  defaults?: {
    name?: string;
    sort_order?: number;
    active?: boolean;
    weight_kg?: number | null;
    unit_price?: number | null;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveType.bind(null, id),
    {},
  );
  const d = defaults ?? { active: true, sort_order: 100 };

  return (
    <form action={formAction} className="del-grid" style={{ alignItems: "end" }}>
      {state.error && (
        <div className="error" style={{ gridColumn: "1 / -1" }}>
          {state.error}
        </div>
      )}
      <label>
        Name
        <input name="name" required defaultValue={d.name ?? ""} />
      </label>
      <label>
        Weight each (kg)
        <input
          name="weight_kg"
          type="number"
          step="1"
          inputMode="decimal"
          defaultValue={d.weight_kg ?? ""}
        />
      </label>
      <label>
        Price each (€)
        <input
          name="unit_price"
          type="number"
          step="0.01"
          inputMode="decimal"
          defaultValue={d.unit_price ?? ""}
        />
      </label>
      <label>
        List position
        <input
          name="sort_order"
          type="number"
          defaultValue={d.sort_order ?? 100}
          title="Lower numbers appear first on the sheet"
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
