"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

export function ReopenInspectionForm({
  action,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction} style={{ display: "grid", gap: 8 }}>
      {state.error && <div className="error">{state.error}</div>}
      {state.ok && <p className="ok">Reopened.</p>}
      <input name="reason" placeholder="Reason (recorded)" required />
      <button className="btn ghost small" type="submit" disabled={pending}>
        {pending ? "Reopening…" : "Reopen inspection"}
      </button>
    </form>
  );
}
