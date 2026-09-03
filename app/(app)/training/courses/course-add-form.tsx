"use client";

import { useActionState } from "react";
import { addCourse, type FormState } from "../actions";

export function CourseAddForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addCourse,
    {},
  );

  return (
    <form action={formAction} style={{ marginTop: 12 }}>
      {state.error && <div className="error">{state.error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          name="name"
          placeholder="New course name"
          required
          style={{ flex: 1 }}
        />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add course"}
        </button>
      </div>
    </form>
  );
}
