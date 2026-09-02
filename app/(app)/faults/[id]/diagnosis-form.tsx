"use client";

import { useActionState } from "react";
import { saveDiagnosis, type FormState } from "./actions";

export function DiagnosisForm({
  faultId,
  defaultValue,
}: {
  faultId: string;
  defaultValue: string | null;
}) {
  const action = saveDiagnosis.bind(null, faultId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <div className="field">
        <textarea
          name="diagnosis"
          defaultValue={defaultValue ?? ""}
          placeholder="What's wrong and what needs doing…"
        />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save diagnosis"}
      </button>
    </form>
  );
}
