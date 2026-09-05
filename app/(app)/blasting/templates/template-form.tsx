"use client";

import { useActionState } from "react";
import { saveTemplate } from "../actions";
import type { FormState } from "../actions";

export function TemplateForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveTemplate,
    {},
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <div className="field">
        <label htmlFor="name">
          Name <span className="req">*</span>
        </label>
        <input id="name" name="name" type="text" required />
      </div>
      <div className="field">
        <label htmlFor="body">
          Message <span className="req">*</span>
        </label>
        <textarea id="body" name="body" rows={3} required />
      </div>
      <button className="btn" type="submit">
        Add template
      </button>
    </form>
  );
}
