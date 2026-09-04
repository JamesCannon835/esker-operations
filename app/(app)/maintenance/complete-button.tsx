"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

export function CompleteButton({
  action,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <button
        className="btn"
        type="submit"
        disabled={pending}
        style={{ fontSize: 16, padding: "12px 20px" }}
      >
        {pending ? "Completing…" : "Complete maintenance report"}
      </button>
      <p className="field-hint" style={{ marginTop: 8 }}>
        Once completed the report is read-only. A manager can reopen it if
        needed — that is recorded.
      </p>
    </form>
  );
}

export function ReopenForm({
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
      <input
        name="reason"
        placeholder="Reason for reopening (recorded)"
        required
      />
      <button className="btn ghost small" type="submit" disabled={pending}>
        {pending ? "Reopening…" : "Reopen report"}
      </button>
    </form>
  );
}
