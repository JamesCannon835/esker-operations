"use client";

import { useActionState, useRef, useEffect } from "react";
import { addPart, type FormState } from "./actions";

export function AddPartForm({ faultId }: { faultId: string }) {
  const action = addPart.bind(null, faultId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful add (no error, not pending).
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="part_name">
            Part <span className="req">*</span>
          </label>
          <input id="part_name" name="part_name" required />
        </div>
        <div className="field">
          <label htmlFor="part_number">Part number</label>
          <input id="part_number" name="part_number" />
        </div>
        <div className="field">
          <label htmlFor="quantity">Qty</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="any"
            defaultValue={1}
          />
        </div>
        <div className="field">
          <label htmlFor="unit_cost">Unit cost (€)</label>
          <input id="unit_cost" name="unit_cost" type="number" step="any" />
        </div>
        <div className="field">
          <label htmlFor="supplier">Supplier</label>
          <input id="supplier" name="supplier" />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add part"}
      </button>
    </form>
  );
}
