"use client";

import { useActionState } from "react";
import { saveProduct, type FormState } from "./actions";

export function ProductForm({
  id,
  defaults,
  submitLabel,
}: {
  id: string | null;
  defaults?: { name?: string; sort_order?: number; active?: boolean };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveProduct.bind(null, id),
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
        Product
        <input name="name" required defaultValue={d.name ?? ""} placeholder="e.g. Lintel" />
      </label>
      <label>
        List position
        <input name="sort_order" type="number" defaultValue={d.sort_order ?? 100} />
      </label>
      <label className="tb-confirm">
        <input type="checkbox" name="active" defaultChecked={d.active ?? true} /> Active
      </label>
      <button className="btn small" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
