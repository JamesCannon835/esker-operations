"use client";

import { useActionState } from "react";
import {
  ACTION_PRIORITIES,
  ACTION_PRIORITY_LABELS,
} from "@/lib/maintenance";
import type { FormState } from "./actions";

type Person = { id: string; full_name: string };

export function ActionEdit({
  action,
  people,
  current,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  people: Person[];
  current: {
    priority: string;
    assigned_to: string | null;
    due_date: string | null;
    detail: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      {state.ok && <p className="ok">Saved.</p>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="a-prio">Priority</label>
          <select id="a-prio" name="priority" defaultValue={current.priority}>
            {ACTION_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {ACTION_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="a-who">Owner</label>
          <select
            id="a-who"
            name="assigned_to"
            defaultValue={current.assigned_to ?? ""}
          >
            <option value="">— Unassigned —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="a-due">Due date</label>
          <input
            id="a-due"
            name="due_date"
            type="date"
            defaultValue={current.due_date ?? ""}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="a-detail">Detail</label>
        <textarea
          id="a-detail"
          name="detail"
          rows={2}
          defaultValue={current.detail ?? ""}
        />
      </div>
      <button className="btn ghost" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export function CompleteWithNote({
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
      <textarea
        name="completion_note"
        rows={2}
        placeholder="What was done (optional)"
      />
      <button
        className="btn"
        type="submit"
        disabled={pending}
        style={{ justifySelf: "start" }}
      >
        {pending ? "Saving…" : "Mark done"}
      </button>
    </form>
  );
}
