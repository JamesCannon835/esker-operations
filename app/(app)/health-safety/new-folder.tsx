"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "./actions";

export function NewFolder({
  action,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        className="btn small ghost"
        onClick={() => setOpen(true)}
      >
        New folder
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", gap: 6 }}>
      <input name="name" placeholder="Folder name" autoFocus required />
      <button className="btn small" type="submit" disabled={pending}>
        {pending ? "…" : "Create"}
      </button>
      <button
        type="button"
        className="btn small ghost"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      {state.error && <span className="error">{state.error}</span>}
    </form>
  );
}
